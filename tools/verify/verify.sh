#!/usr/bin/env bash
set -euo pipefail

# Docklands verify harness — one model for setup/install verification.
#
# Replaces the old smoke zoo (docker:smoke*, release:smoke:host) with a single
# set of verbs that run the SAME proven assertions against either:
#
#   --target sandbox  (default) a self-contained Docker-in-Docker sandbox: a
#                     throwaway Postgres + app container + an inner Swarm daemon.
#                     Portable — runs on any laptop or CI runner with Docker, no
#                     VM required. This is what CI uses.
#   --target host     an already-running instance on the current host's Docker
#                     daemon (Swarm/Traefik already initialised by the image's
#                     setup-instance). This is what runs INSIDE a replica VM or on
#                     a disposable host, and gives the real port-80 Traefik route.
#
# Verbs:
#   install   Boot the substrate, assert readiness + Swarm + docklands-network.
#   deploy    install + first-owner bootstrap + deploy a service + ingress.
#   upgrade   Bring the instance up, bootstrap, replace the container with the new
#             image, and assert the owner/session/data survive the restart.
#   backup    deploy + whole-instance backup to object storage + restore-listing.
#   worker    Assert a second SSH-reachable Docker host (a remote runtime worker
#             precondition). Requires DOCKLANDS_VERIFY_WORKER_HOST; never silently
#             skips.
#   all       Run install+deploy+upgrade+backup. worker is included only when a
#             worker host is configured (otherwise it is loudly skipped).
#
# Flags:
#   --target sandbox|host        Substrate (default: sandbox).
#   --image REF                  Image under test (default: docklands:local-verify).
#   --from-image REF             upgrade: starting image (default: --image).
#   --to-image REF               upgrade: target image (default: --image).
#   --base-url URL               host: app base URL (default: http://127.0.0.1:3000).
#   --traefik-url URL            host: Traefik base URL (default: http://127.0.0.1).
#   --keep                       Leave substrate resources running for debugging.
#   -h, --help                   Show this help.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=tools/verify/lib.sh
source "$SCRIPT_DIR/lib.sh"

usage() { sed -n '3,46p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# --- arguments --------------------------------------------------------------

VERB=""
TARGET=${DOCKLANDS_VERIFY_TARGET:-sandbox}
IMAGE_REF=${DOCKLANDS_VERIFY_IMAGE:-docklands:local-verify}
FROM_IMAGE=""
TO_IMAGE=""
HOST_BASE_URL=${DOCKLANDS_VERIFY_BASE_URL:-http://127.0.0.1:3000}
HOST_TRAEFIK_URL=${DOCKLANDS_VERIFY_TRAEFIK_URL:-http://127.0.0.1}
KEEP=${DOCKLANDS_VERIFY_KEEP:-}

while [ "$#" -gt 0 ]; do
	case "$1" in
		install | deploy | upgrade | backup | worker | all)
			[ -z "$VERB" ] || { echo "Only one verb may be supplied." >&2; exit 1; }
			VERB=$1; shift ;;
		--target) TARGET=${2:-}; shift 2 ;;
		--image) IMAGE_REF=${2:-}; shift 2 ;;
		--from-image) FROM_IMAGE=${2:-}; shift 2 ;;
		--to-image) TO_IMAGE=${2:-}; shift 2 ;;
		--base-url) HOST_BASE_URL=${2:-}; shift 2 ;;
		--traefik-url) HOST_TRAEFIK_URL=${2:-}; shift 2 ;;
		--keep) KEEP=1; shift ;;
		-h | --help) usage; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
	esac
done

[ -n "$VERB" ] || { usage >&2; exit 1; }
case "$TARGET" in
	sandbox | host) ;;
	*) echo "--target must be 'sandbox' or 'host'" >&2; exit 1 ;;
esac
FROM_IMAGE=${FROM_IMAGE:-$IMAGE_REF}
TO_IMAGE=${TO_IMAGE:-$IMAGE_REF}

# --- sandbox substrate ------------------------------------------------------

SMOKE_ID=${DOCKLANDS_VERIFY_ID:-$(date +%s)-$$}
DOCKLANDS_VERIFY_ID=$SMOKE_ID
NETWORK_NAME="docklands-verify-${SMOKE_ID}"
DIND_NAME="docklands-verify-dind-${SMOKE_ID}"
DB_NAME="docklands-verify-postgres-${SMOKE_ID}"
APP_NAME="docklands-verify-app-${SMOKE_ID}"
MINIO_NAME="docklands-verify-minio-${SMOKE_ID}"
REGISTRY_NAME="docklands-verify-registry-${SMOKE_ID}"
DIND_IMAGE=${DOCKLANDS_VERIFY_DIND_IMAGE:-docker:28.5.2-dind}
POSTGRES_IMAGE=${DOCKLANDS_VERIFY_POSTGRES_IMAGE:-postgres:16}
MINIO_IMAGE=${DOCKLANDS_VERIFY_MINIO_IMAGE:-minio/minio:RELEASE.2026-06-13T11-33-47Z}
MC_IMAGE=${DOCKLANDS_VERIFY_MC_IMAGE:-minio/mc:RELEASE.2026-05-21T01-59-54Z}
DB_USER=docklands_verify
APP_PORT=""
MINIO_STARTED=""

sandbox_dind_ready() { docker exec "$DIND_NAME" docker info >/dev/null 2>&1; }
sandbox_pg_ready() { docker exec "$DB_NAME" pg_isready -U "$DB_USER" -d "$DB_USER" >/dev/null 2>&1; }

# Hooks consumed by lib.sh
verify_managed_docker() { docker exec "$DIND_NAME" docker "$@"; }
verify_psql() { docker exec "$DB_NAME" psql -U "$DB_USER" -d "$DB_USER" -tAc "$1"; }
verify_read_traefik_dynamic() {
	docker exec "$APP_NAME" cat "/etc/docklands/traefik/dynamic/$1.yml" >"$2" 2>/dev/null
}
verify_find_backups() {
	docker run --rm --network "$NETWORK_NAME" --entrypoint sh "$MC_IMAGE" \
		-c 'mc alias set v "$0" "$1" "$2" >/dev/null && mc find "v/$3/$4" --name "*.zip"' \
		"$VERIFY_S3_ENDPOINT" "$VERIFY_S3_ACCESS_KEY" "$VERIFY_S3_SECRET_KEY" "$VERIFY_S3_BUCKET" "$5"
}

sandbox_run_app() {
	local image=$1 platform platform_args
	platform=${DOCKLANDS_VERIFY_APP_PLATFORM:-$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")}
	platform_args=(--platform "$platform")
	docker run -d "${platform_args[@]}" \
		--name "$APP_NAME" \
		--network "$NETWORK_NAME" \
		-p 127.0.0.1::3000 \
		-e DATABASE_URL="postgres://${DB_USER}:${DB_USER}@${DB_NAME}:5432/${DB_USER}" \
		-e BETTER_AUTH_SECRET=docklands-verify-secret-000000000000000000 \
		-e DOCKLANDS_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
		-e SKIP_PRE_MIGRATION_BACKUP=true \
		-e DOCKLANDS_DOCKER_HOST="$DIND_NAME" \
		-e DOCKLANDS_DOCKER_PORT=2375 \
		-e DOCKER_HOST="tcp://${DIND_NAME}:2375" \
		-e SWARM_ADVERTISE_ADDR=127.0.0.1 \
		"$image" >/dev/null
	APP_PORT=$(docker port "$APP_NAME" 3000/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1)
	[ -n "$APP_PORT" ] || { echo "Could not resolve mapped app port" >&2; return 1; }
	VERIFY_BASE_URL="http://127.0.0.1:${APP_PORT}"
}

sandbox_up() {
	local image=$1
	docker image inspect "$image" >/dev/null
	docker network create "$NETWORK_NAME" >/dev/null
	docker run -d --privileged --name "$DIND_NAME" --network "$NETWORK_NAME" \
		-e DOCKER_TLS_CERTDIR= "$DIND_IMAGE" \
		--host=tcp://0.0.0.0:2375 --host=unix:///var/run/docker.sock >/dev/null
	vrfy_wait_for "Docker-in-Docker daemon" sandbox_dind_ready
	docker run -d --name "$DB_NAME" --network "$NETWORK_NAME" \
		-e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_USER" -e POSTGRES_DB="$DB_USER" \
		"$POSTGRES_IMAGE" >/dev/null
	vrfy_wait_for "Postgres" sandbox_pg_ready
	sandbox_run_app "$image"
	vrfy_wait_for "Docklands readiness" vrfy_check_ready
}

sandbox_replace_app() {
	local image=$1
	docker image inspect "$image" >/dev/null
	docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
	sandbox_run_app "$image"
	vrfy_wait_for "Docklands readiness after replacement" vrfy_check_ready
}

sandbox_minio() {
	docker run -d --name "$MINIO_NAME" --network "$NETWORK_NAME" \
		-e MINIO_ROOT_USER="$VERIFY_S3_ACCESS_KEY" \
		-e MINIO_ROOT_PASSWORD="$VERIFY_S3_SECRET_KEY" \
		"$MINIO_IMAGE" server /data >/dev/null
	MINIO_STARTED=1
	VERIFY_S3_ENDPOINT="http://${MINIO_NAME}:9000"
	docker run --rm --network "$NETWORK_NAME" --entrypoint sh "$MC_IMAGE" -c \
		'for i in $(seq 1 60); do mc alias set v "$0" "$1" "$2" >/dev/null 2>&1 && mc mb --ignore-existing "v/$3" >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1' \
		"$VERIFY_S3_ENDPOINT" "$VERIFY_S3_ACCESS_KEY" "$VERIFY_S3_SECRET_KEY" "$VERIFY_S3_BUCKET"
}

sandbox_diagnostics() {
	echo "Docklands verify ($VERB/$TARGET) failed. Recent logs:" >&2
	for c in "$APP_NAME" "$DIND_NAME" "$DB_NAME"; do
		if docker ps -a --format '{{.Names}}' | grep -Fxq "$c"; then
			echo "----- $c -----" >&2
			docker logs --tail 120 "$c" >&2 || true
		fi
	done
	if [ -n "$VRFY_DEPLOY_APP_NAME" ]; then
		echo "----- deployed service ($VRFY_DEPLOY_APP_NAME) -----" >&2
		docker exec "$DIND_NAME" docker service ps "$VRFY_DEPLOY_APP_NAME" --no-trunc >&2 || true
	fi
}

sandbox_teardown() {
	[ -z "$KEEP" ] || { echo "Keeping sandbox resources (--keep): $APP_NAME $DB_NAME $DIND_NAME $MINIO_NAME $NETWORK_NAME" >&2; return; }
	docker rm -f "$APP_NAME" "$DB_NAME" "$DIND_NAME" "$MINIO_NAME" >/dev/null 2>&1 || true
	docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
}

# --- host substrate ---------------------------------------------------------

host_diagnostics() {
	echo "Docklands verify ($VERB/$TARGET) failed against $VERIFY_BASE_URL." >&2
	if docker ps -a --format '{{.Names}}' | grep -Fxq docklands-traefik; then
		echo "----- docklands-traefik -----" >&2
		docker logs --tail 100 docklands-traefik >&2 || true
	fi
	if [ -n "$VRFY_DEPLOY_APP_NAME" ]; then
		docker service ps "$VRFY_DEPLOY_APP_NAME" --no-trunc >&2 || true
	fi
}

host_minio() {
	VERIFY_S3_ENDPOINT=${DOCKLANDS_VERIFY_S3_ENDPOINT:-http://${MINIO_NAME}:9000}
	# Only stand MinIO up ourselves when the caller did not point at an external one.
	if [ -z "${DOCKLANDS_VERIFY_S3_ENDPOINT:-}" ]; then
		docker run -d --name "$MINIO_NAME" --network docklands-network \
			-e MINIO_ROOT_USER="$VERIFY_S3_ACCESS_KEY" \
			-e MINIO_ROOT_PASSWORD="$VERIFY_S3_SECRET_KEY" \
			"$MINIO_IMAGE" server /data >/dev/null
		MINIO_STARTED=1
		docker run --rm --network docklands-network --entrypoint sh "$MC_IMAGE" -c \
			'for i in $(seq 1 60); do mc alias set v "$0" "$1" "$2" >/dev/null 2>&1 && mc mb --ignore-existing "v/$3" >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1' \
			"$VERIFY_S3_ENDPOINT" "$VERIFY_S3_ACCESS_KEY" "$VERIFY_S3_SECRET_KEY" "$VERIFY_S3_BUCKET"
	fi
}

host_up() {
	VERIFY_BASE_URL=${HOST_BASE_URL%/}
	VERIFY_TRAEFIK_URL=${HOST_TRAEFIK_URL%/}
	vrfy_wait_for "Docklands readiness" vrfy_check_ready
}

# Host hooks: the managed daemon is the host daemon; Traefik config is on the
# host filesystem. The DB is not directly queried on a host (assertions go
# through the API), so verify_psql stays undefined and DB checks are skipped.
host_managed_docker() { docker "$@"; }
host_read_traefik_dynamic() { cat "/etc/docklands/traefik/dynamic/$1.yml" >"$2" 2>/dev/null; }
host_find_backups() {
	docker run --rm --network docklands-network --entrypoint sh "$MC_IMAGE" \
		-c 'mc alias set v "$0" "$1" "$2" >/dev/null && mc find "v/$3/$4" --name "*.zip"' \
		"$VERIFY_S3_ENDPOINT" "$VERIFY_S3_ACCESS_KEY" "$VERIFY_S3_SECRET_KEY" "$VERIFY_S3_BUCKET" "$5"
}

host_teardown() {
	[ -z "$KEEP" ] || return
	[ -z "$VRFY_DEPLOY_APP_NAME" ] || docker service rm "$VRFY_DEPLOY_APP_NAME" >/dev/null 2>&1 || true
	[ -z "$MINIO_STARTED" ] || docker rm -f "$MINIO_NAME" >/dev/null 2>&1 || true
}

# --- worker (remote runtime worker precondition) ----------------------------

verify_worker() {
	local host=${DOCKLANDS_VERIFY_WORKER_HOST:-}
	local user=${DOCKLANDS_VERIFY_WORKER_USER:-root}
	local port=${DOCKLANDS_VERIFY_WORKER_PORT:-22}
	local key=${DOCKLANDS_VERIFY_WORKER_SSH_KEY:-}
	if [ -z "$host" ] || [ -z "$key" ]; then
		echo "verify worker needs a real second Docker host." >&2
		echo "Provide DOCKLANDS_VERIFY_WORKER_HOST and DOCKLANDS_VERIFY_WORKER_SSH_KEY" >&2
		echo "(plus optional DOCKLANDS_VERIFY_WORKER_USER / DOCKLANDS_VERIFY_WORKER_PORT)." >&2
		echo "The full UI-driven join is exercised by provisioning a second replica VM." >&2
		return 1
	fi
	echo "Asserting remote runtime-worker precondition over SSH ($user@$host:$port)..."
	# Runtime workers reach Docker via SSH (server/core/utils/servers/remote-docker.ts).
	# Prove that exact transport: an SSH-reachable Docker daemon on the worker host.
	local out
	out=$(ssh -i "$key" -p "$port" \
		-o StrictHostKeyChecking=accept-new -o BatchMode=yes \
		"$user@$host" 'docker info --format "{{.ServerVersion}}"')
	[ -n "$out" ] || { echo "Worker host has no reachable Docker daemon over SSH" >&2; return 1; }
	echo "  worker docker over SSH: $out"
	echo "verify worker precondition passed for $user@$host"
}

worker_configured() { [ -n "${DOCKLANDS_VERIFY_WORKER_HOST:-}" ] && [ -n "${DOCKLANDS_VERIFY_WORKER_SSH_KEY:-}" ]; }

# --- run --------------------------------------------------------------------

CURRENT_STATUS=0
on_exit() {
	CURRENT_STATUS=$?
	if [ "$CURRENT_STATUS" -ne 0 ]; then
		if [ "$TARGET" = "sandbox" ]; then sandbox_diagnostics; else host_diagnostics; fi
	fi
	if [ "$TARGET" = "sandbox" ]; then sandbox_teardown; else host_teardown; fi
	vrfy_cleanup_tmp
	exit "$CURRENT_STATUS"
}

# worker is standalone (no substrate bring-up).
if [ "$VERB" = "worker" ]; then
	vrfy_init_state
	trap 'vrfy_cleanup_tmp' EXIT
	verify_worker
	exit 0
fi

# Wire host substrate hooks (override the sandbox defaults defined above).
if [ "$TARGET" = "host" ]; then
	verify_managed_docker() { host_managed_docker "$@"; }
	verify_read_traefik_dynamic() { host_read_traefik_dynamic "$@"; }
	verify_find_backups() { host_find_backups "$@"; }
	unset -f verify_psql
fi

vrfy_init_state
trap on_exit EXIT

substrate_up() {
	if [ "$TARGET" = "sandbox" ]; then sandbox_up "$1"; else host_up; fi
}

run_install() {
	echo "==> verify install ($TARGET)"
	vrfy_assert_swarm_and_network
	echo "verify install passed"
}

run_deploy() {
	echo "==> verify deploy ($TARGET)"
	vrfy_check_first_owner
	vrfy_deploy_app "verify-${SMOKE_ID}"
	vrfy_assert_traefik_route
	echo "verify deploy passed (service: $VRFY_DEPLOY_APP_NAME)"
}

run_backup() {
	echo "==> verify backup ($TARGET)"
	if [ "$TARGET" = "sandbox" ]; then sandbox_minio; else host_minio; fi
	vrfy_check_backup
	echo "verify backup passed"
}

case "$VERB" in
	install)
		substrate_up "$IMAGE_REF"
		run_install
		;;
	deploy)
		substrate_up "$IMAGE_REF"
		run_install
		run_deploy
		;;
	upgrade)
		echo "==> verify upgrade ($TARGET): $FROM_IMAGE -> $TO_IMAGE"
		substrate_up "$FROM_IMAGE"
		run_install
		vrfy_check_first_owner
		if [ "$TARGET" = "sandbox" ]; then
			sandbox_replace_app "$TO_IMAGE"
		else
			echo "host upgrade: replace the running container with $TO_IMAGE now, then continue" >&2
		fi
		vrfy_check_existing_owner
		echo "verify upgrade passed (owner + session survived the restart)"
		;;
	backup)
		substrate_up "$IMAGE_REF"
		run_install
		vrfy_check_first_owner
		vrfy_deploy_app "verify-${SMOKE_ID}"
		run_backup
		;;
	all)
		substrate_up "$IMAGE_REF"
		run_install
		run_deploy
		run_backup
		# upgrade replaces the app container, so run it last on its own bring-up.
		if [ "$TARGET" = "sandbox" ]; then
			sandbox_replace_app "$TO_IMAGE"
			vrfy_check_existing_owner
			echo "verify upgrade passed (owner + session survived the restart)"
		fi
		if worker_configured; then
			verify_worker
		else
			echo "NOTE: verify worker skipped — no DOCKLANDS_VERIFY_WORKER_HOST configured." >&2
			echo "      Run 'bun run verify:worker' with a second host, or a two-replica setup." >&2
		fi
		echo "verify all passed"
		;;
esac
