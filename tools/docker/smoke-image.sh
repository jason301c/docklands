#!/bin/bash
set -euo pipefail

IMAGE_REF=${1:-docklands:local-smoke}
DIND_IMAGE=${DIND_IMAGE:-docker:28.5.2-dind}
POSTGRES_IMAGE=${POSTGRES_IMAGE:-postgres:16}
WAIT_SECONDS=${DOCKLANDS_SMOKE_TIMEOUT_SECONDS:-240}
SMOKE_ID=${DOCKLANDS_SMOKE_ID:-$(date +%s)-$$}

NETWORK_NAME="docklands-smoke-${SMOKE_ID}"
DIND_NAME="docklands-smoke-dind-${SMOKE_ID}"
DB_NAME="docklands-smoke-postgres-${SMOKE_ID}"
APP_NAME="docklands-smoke-app-${SMOKE_ID}"
READY_BODY=$(mktemp)
APP_PORT=""
APP_PLATFORM=""

print_diagnostics() {
	echo "Docklands image smoke failed. Recent container logs:" >&2
	for container in "$APP_NAME" "$DIND_NAME" "$DB_NAME"; do
		if docker ps -a --format '{{.Names}}' | grep -Fxq "$container"; then
			echo "----- $container -----" >&2
			docker logs --tail 200 "$container" >&2 || true
		fi
	done
	if [ -s "$READY_BODY" ]; then
		echo "----- last /api/ready response -----" >&2
		cat "$READY_BODY" >&2
		echo >&2
	fi
}

cleanup() {
	local status=$?
	if [ "$status" -ne 0 ]; then
		print_diagnostics
	fi
	rm -f "$READY_BODY"
	if [ "${DOCKLANDS_SMOKE_KEEP:-}" = "1" ]; then
		echo "Keeping smoke resources because DOCKLANDS_SMOKE_KEEP=1:" >&2
		echo "  $APP_NAME" >&2
		echo "  $DB_NAME" >&2
		echo "  $DIND_NAME" >&2
		echo "  $NETWORK_NAME" >&2
		exit "$status"
	fi
	docker rm -f "$APP_NAME" "$DB_NAME" "$DIND_NAME" >/dev/null 2>&1 || true
	docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
	exit "$status"
}
trap cleanup EXIT

wait_for() {
	local label=$1
	shift
	local deadline=$((SECONDS + WAIT_SECONDS))
	until "$@"; do
		if [ "$SECONDS" -ge "$deadline" ]; then
			echo "Timed out waiting for $label after ${WAIT_SECONDS}s" >&2
			return 1
		fi
		sleep 2
	done
}

check_ready() {
	local status
	status=$(curl -s -o "$READY_BODY" -w "%{http_code}" \
		"http://127.0.0.1:${APP_PORT}/api/ready" || true)
	if [ "$status" != "200" ]; then
		return 1
	fi

	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const runtime = body.checks?.runtime;
if (
	body.ok !== true ||
	body.checks?.database?.ok !== true ||
	runtime?.ok !== true ||
	runtime?.phase !== "ready" ||
	(runtime.failedCriticalSteps ?? []).length !== 0
) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$READY_BODY"
}

dind_ready() {
	docker exec "$DIND_NAME" docker info >/dev/null 2>&1
}

postgres_ready() {
	docker exec "$DB_NAME" pg_isready -U docklands_smoke -d docklands_smoke \
		>/dev/null 2>&1
}

docker image inspect "$IMAGE_REF" >/dev/null
APP_PLATFORM=${DOCKLANDS_SMOKE_APP_PLATFORM:-$(docker image inspect \
	--format '{{.Os}}/{{.Architecture}}' "$IMAGE_REF")}
APP_PLATFORM_ARGS=(--platform "$APP_PLATFORM")

docker network create "$NETWORK_NAME" >/dev/null

docker run -d \
	--privileged \
	--name "$DIND_NAME" \
	--network "$NETWORK_NAME" \
	-e DOCKER_TLS_CERTDIR= \
	"$DIND_IMAGE" \
	--host=tcp://0.0.0.0:2375 \
	--host=unix:///var/run/docker.sock >/dev/null

wait_for "Docker-in-Docker daemon" dind_ready

docker run -d \
	--name "$DB_NAME" \
	--network "$NETWORK_NAME" \
	-e POSTGRES_USER=docklands_smoke \
	-e POSTGRES_PASSWORD=docklands_smoke \
	-e POSTGRES_DB=docklands_smoke \
	"$POSTGRES_IMAGE" >/dev/null

wait_for "Postgres" postgres_ready

docker run -d \
	"${APP_PLATFORM_ARGS[@]}" \
	--name "$APP_NAME" \
	--network "$NETWORK_NAME" \
	-p 127.0.0.1::3000 \
	-e DATABASE_URL="postgres://docklands_smoke:docklands_smoke@${DB_NAME}:5432/docklands_smoke" \
	-e BETTER_AUTH_SECRET=docklands-smoke-secret-000000000000000000 \
	-e DOCKLANDS_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
	-e SKIP_PRE_MIGRATION_BACKUP=true \
	-e DOCKLANDS_DOCKER_HOST="$DIND_NAME" \
	-e DOCKLANDS_DOCKER_PORT=2375 \
	-e SWARM_ADVERTISE_ADDR=127.0.0.1 \
	"$IMAGE_REF" >/dev/null

APP_PORT=$(docker port "$APP_NAME" 3000/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1)
if [ -z "$APP_PORT" ]; then
	echo "Could not resolve mapped app port" >&2
	exit 1
fi

wait_for "Docklands readiness" check_ready

SWARM_STATE=$(docker exec "$DIND_NAME" docker info \
	--format '{{.Swarm.LocalNodeState}}/{{.Swarm.ControlAvailable}}')
if [ "$SWARM_STATE" != "active/true" ]; then
	echo "Expected Docker-in-Docker Swarm active/true, got $SWARM_STATE" >&2
	exit 1
fi

NETWORK_STATE=$(docker exec "$DIND_NAME" docker network inspect docklands-network \
	--format '{{.Driver}}/{{.Scope}}')
if [ "$NETWORK_STATE" != "overlay/swarm" ]; then
	echo "Expected docklands-network overlay/swarm, got $NETWORK_STATE" >&2
	exit 1
fi

echo "Docklands image smoke passed for $IMAGE_REF"
echo "  readiness: http://127.0.0.1:${APP_PORT}/api/ready"
echo "  dind swarm: $SWARM_STATE"
echo "  docklands-network: $NETWORK_STATE"
