#!/bin/bash
set -euo pipefail

IMAGE_REF=${1:-docklands:local-smoke}
DIND_IMAGE=${DIND_IMAGE:-docker:28.5.2-dind}
POSTGRES_IMAGE=${POSTGRES_IMAGE:-postgres:16}
WAIT_SECONDS=${DOCKLANDS_SMOKE_TIMEOUT_SECONDS:-240}
SMOKE_ID=${DOCKLANDS_SMOKE_ID:-$(date +%s)-$$}
RUN_OPERATOR_SMOKE=${DOCKLANDS_SMOKE_OPERATOR:-}
RUN_DEPLOY_SMOKE=${DOCKLANDS_SMOKE_DEPLOY:-}
REGISTRY_IMAGE=${DOCKLANDS_SMOKE_REGISTRY_IMAGE:-registry:2}

NETWORK_NAME="docklands-smoke-${SMOKE_ID}"
DIND_NAME="docklands-smoke-dind-${SMOKE_ID}"
DB_NAME="docklands-smoke-postgres-${SMOKE_ID}"
APP_NAME="docklands-smoke-app-${SMOKE_ID}"
REGISTRY_NAME="docklands-smoke-registry"
SMOKE_DEPLOY_APP_BASE=$(printf "smoke-%s" "$SMOKE_ID" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-42)
if [ -z "$SMOKE_DEPLOY_APP_BASE" ]; then
	SMOKE_DEPLOY_APP_BASE="smoke-deploy"
fi
SMOKE_DEPLOY_APP_NAME=""
SMOKE_DEPLOY_IMAGE="127.0.0.1:5000/docklands-smoke-app:${SMOKE_DEPLOY_APP_BASE}"
READY_BODY=$(mktemp)
REGISTER_BODY=$(mktemp)
SIGNUP_BODY=$(mktemp)
SESSION_BODY=$(mktemp)
SECOND_SIGNUP_BODY=$(mktemp)
HOME_HEADERS=$(mktemp)
REGISTER_AFTER_HEADERS=$(mktemp)
INGRESS_UPDATE_BODY=$(mktemp)
INGRESS_SETTINGS_BODY=$(mktemp)
WORKSPACE_BODY=$(mktemp)
APPLICATION_BODY=$(mktemp)
DOCKER_PROVIDER_BODY=$(mktemp)
APPLICATION_UPDATE_BODY=$(mktemp)
DEPLOY_BODY=$(mktemp)
COOKIE_JAR=$(mktemp)
APP_PORT=""
APP_PLATFORM=""
SMOKE_DEPLOY_RECORD=""

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
	if [ -s "$SIGNUP_BODY" ]; then
		echo "----- last first-owner signup response -----" >&2
		cat "$SIGNUP_BODY" >&2
		echo >&2
	fi
	if [ -s "$SECOND_SIGNUP_BODY" ]; then
		echo "----- last second-signup response -----" >&2
		cat "$SECOND_SIGNUP_BODY" >&2
		echo >&2
	fi
	if [ -s "$INGRESS_UPDATE_BODY" ]; then
		echo "----- last ingress update response -----" >&2
		cat "$INGRESS_UPDATE_BODY" >&2
		echo >&2
	fi
	if [ -s "$INGRESS_SETTINGS_BODY" ]; then
		echo "----- last ingress settings response -----" >&2
		cat "$INGRESS_SETTINGS_BODY" >&2
		echo >&2
	fi
	if [ -s "$WORKSPACE_BODY" ]; then
		echo "----- last workspaces.create response -----" >&2
		cat "$WORKSPACE_BODY" >&2
		echo >&2
	fi
	if [ -s "$APPLICATION_BODY" ]; then
		echo "----- last application.create response -----" >&2
		cat "$APPLICATION_BODY" >&2
		echo >&2
	fi
	if [ -s "$DOCKER_PROVIDER_BODY" ]; then
		echo "----- last application.saveDockerProvider response -----" >&2
		cat "$DOCKER_PROVIDER_BODY" >&2
		echo >&2
	fi
	if [ -s "$APPLICATION_UPDATE_BODY" ]; then
		echo "----- last application.update response -----" >&2
		cat "$APPLICATION_UPDATE_BODY" >&2
		echo >&2
	fi
	if [ -s "$DEPLOY_BODY" ]; then
		echo "----- last application.deploy response -----" >&2
		cat "$DEPLOY_BODY" >&2
		echo >&2
	fi
	if [ -n "$SMOKE_DEPLOY_APP_NAME" ] && docker ps -a --format '{{.Names}}' | grep -Fxq "$DIND_NAME"; then
		echo "----- smoke deploy service state -----" >&2
		docker exec "$DIND_NAME" docker service ps "$SMOKE_DEPLOY_APP_NAME" \
			--no-trunc >&2 || true
	fi
}

cleanup() {
	local status=$?
	if [ "$status" -ne 0 ]; then
		print_diagnostics
	fi
	rm -f \
		"$READY_BODY" \
		"$REGISTER_BODY" \
		"$SIGNUP_BODY" \
		"$SESSION_BODY" \
		"$SECOND_SIGNUP_BODY" \
		"$HOME_HEADERS" \
		"$REGISTER_AFTER_HEADERS" \
		"$INGRESS_UPDATE_BODY" \
		"$INGRESS_SETTINGS_BODY" \
		"$WORKSPACE_BODY" \
		"$APPLICATION_BODY" \
		"$DOCKER_PROVIDER_BODY" \
		"$APPLICATION_UPDATE_BODY" \
		"$DEPLOY_BODY" \
		"$COOKIE_JAR"
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

expect_status() {
	local label=$1
	local expected=$2
	local actual=$3
	local response_file=$4

	if [ "$actual" = "$expected" ]; then
		return 0
	fi

	echo "Expected $label HTTP $expected, got $actual" >&2
	if [ -s "$response_file" ]; then
		echo "----- $label response -----" >&2
		head -c 1200 "$response_file" >&2
		echo >&2
	fi
	return 1
}

trpc_post() {
	local procedure=$1
	local body=$2
	local output_file=$3
	local label=$4
	local status

	status=$(curl -sS -o "$output_file" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"http://127.0.0.1:${APP_PORT}/api/trpc/${procedure}" \
		--data "$body")
	expect_status "$label" "200" "$status" "$output_file"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.error) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$output_file"
}

assert_ingress_mode() {
	local expected=$1
	local status
	local persisted_mode

	status=$(curl -sS -o "$INGRESS_SETTINGS_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"http://127.0.0.1:${APP_PORT}/api/trpc/settings.getWebServerSettings")
	expect_status "read ingress settings" "200" "$status" \
		"$INGRESS_SETTINGS_BODY"
	node -e '
const fs = require("node:fs");
const expected = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const mode = body.result?.data?.json?.defaultIngressMode;
if (mode !== expected) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$INGRESS_SETTINGS_BODY" "$expected"

	persisted_mode=$(docker exec "$DB_NAME" psql \
		-U docklands_smoke \
		-d docklands_smoke \
		-tAc 'select "defaultIngressMode" from "webServerSettings" order by created_at asc limit 1')
	if [ "$persisted_mode" != "$expected" ]; then
		echo "Expected persisted default ingress mode $expected, got: $persisted_mode" >&2
		exit 1
	fi
}

update_ingress_mode() {
	local mode=$1
	local status

	status=$(curl -sS -o "$INGRESS_UPDATE_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"http://127.0.0.1:${APP_PORT}/api/trpc/settings.updateDefaultIngressMode" \
		--data "{\"json\":{\"defaultIngressMode\":\"${mode}\"}}")
	expect_status "update default ingress mode" "200" "$status" \
		"$INGRESS_UPDATE_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.result?.data?.json !== true) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$INGRESS_UPDATE_BODY"

	assert_ingress_mode "$mode"
}

check_operator_smoke() {
	local status
	local bootstrap_record

	status=$(curl -sS -o "$REGISTER_BODY" -w "%{http_code}" \
		"http://127.0.0.1:${APP_PORT}/register")
	expect_status "register page" "200" "$status" "$REGISTER_BODY"
	node -e '
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[1], "utf8");
if (!html.includes("Set up Docklands") || !html.includes("Create account")) {
	console.error("Register page did not render the first-owner setup form");
	process.exit(1);
}
' "$REGISTER_BODY"

	status=$(curl -sS -o "$SIGNUP_BODY" -w "%{http_code}" \
		-c "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"http://127.0.0.1:${APP_PORT}/api/auth/sign-up/email" \
		--data '{"email":"owner@docklands.local","password":"docklands-owner-000000","name":"Owner","lastName":"User"}')
	expect_status "first-owner signup" "200" "$status" "$SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (
	typeof body.token !== "string" ||
	body.user?.email !== "owner@docklands.local" ||
	body.user?.name !== "Owner" ||
	body.user?.lastName !== "User"
) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const jar = fs.readFileSync(process.argv[1], "utf8");
if (
	!jar
		.split(/\r?\n/)
		.some(
			(line) =>
				line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")),
		)
) {
	console.error("Signup did not create an auth cookie");
	process.exit(1);
}
' "$COOKIE_JAR"

	status=$(curl -sS -o "$SESSION_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"http://127.0.0.1:${APP_PORT}/api/auth/get-session")
	expect_status "auth session" "200" "$status" "$SESSION_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.user?.email !== "owner@docklands.local" || !body.session) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SESSION_BODY"

	status=$(curl -sS -D "$HOME_HEADERS" -o /dev/null -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"http://127.0.0.1:${APP_PORT}/")
	expect_status "authenticated home redirect" "307" "$status" "$HOME_HEADERS"
	node -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
if (!/^location:\s*\/dashboard\/workspace\s*$/im.test(headers)) {
	console.error(headers);
	process.exit(1);
}
' "$HOME_HEADERS"

	status=$(curl -sS -D "$REGISTER_AFTER_HEADERS" -o /dev/null \
		-w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"http://127.0.0.1:${APP_PORT}/register")
	expect_status "post-bootstrap register redirect" "307" "$status" \
		"$REGISTER_AFTER_HEADERS"
	node -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
if (!/^location:\s*\/\s*$/im.test(headers)) {
	console.error(headers);
	process.exit(1);
}
' "$REGISTER_AFTER_HEADERS"

	status=$(curl -sS -o "$SECOND_SIGNUP_BODY" -w "%{http_code}" \
		-H "content-type: application/json" \
		-X POST \
		"http://127.0.0.1:${APP_PORT}/api/auth/sign-up/email" \
		--data '{"email":"second@docklands.local","password":"docklands-owner-000000","name":"Second","lastName":"User"}')
	expect_status "second signup rejection" "400" "$status" \
		"$SECOND_SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.message !== "Admin is already created") {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SECOND_SIGNUP_BODY"

	bootstrap_record=$(docker exec "$DB_NAME" psql \
		-U docklands_smoke \
		-d docklands_smoke \
		-tAc 'select (select count(*) from organization) || '"'"'|'"'"' || (select count(*) from member where role = '"'"'owner'"'"') || '"'"'|'"'"' || coalesce((select o.name || '"'"'|'"'"' || m.role || '"'"'|'"'"' || u.email from organization o join member m on m.organization_id = o.id join "user" u on u.id = m.user_id limit 1), '"'"''"'"')')
	if [ "$bootstrap_record" != "1|1|Docklands|owner|owner@docklands.local" ]; then
		echo "Expected first-owner bootstrap DB row, got: $bootstrap_record" >&2
		exit 1
	fi

	assert_ingress_mode "public"
	update_ingress_mode "tunnel"
	update_ingress_mode "public"
}

dind_registry_ready() {
	docker exec "$DIND_NAME" sh -c \
		'wget -q -O /dev/null http://127.0.0.1:5000/v2/' >/dev/null 2>&1
}

prepare_smoke_deploy_image() {
	docker image inspect "$REGISTRY_IMAGE" >/dev/null 2>&1 || docker pull "$REGISTRY_IMAGE"

	docker save "$REGISTRY_IMAGE" | docker exec -i "$DIND_NAME" docker load >/dev/null
	docker exec "$DIND_NAME" docker run -d \
		--name "$REGISTRY_NAME" \
		-p 5000:5000 \
		"$REGISTRY_IMAGE" >/dev/null
	wait_for "Docker-in-Docker registry" dind_registry_ready

	docker save "$DIND_IMAGE" | docker exec -i "$DIND_NAME" docker load >/dev/null
	docker exec "$DIND_NAME" docker tag "$DIND_IMAGE" "$SMOKE_DEPLOY_IMAGE"
	docker exec "$DIND_NAME" docker push "$SMOKE_DEPLOY_IMAGE" >/dev/null
}

deployed_service_ready() {
	if [ -z "$SMOKE_DEPLOY_APP_NAME" ]; then
		return 1
	fi
	docker exec "$DIND_NAME" docker service inspect "$SMOKE_DEPLOY_APP_NAME" \
		>/dev/null 2>&1 || return 1
	docker exec "$DIND_NAME" docker service ps "$SMOKE_DEPLOY_APP_NAME" \
		--filter desired-state=running \
		--format '{{.CurrentState}} {{.Error}}' 2>/dev/null | grep -q '^Running'
}

deploy_record_done() {
	if [ -z "$SMOKE_DEPLOY_APP_NAME" ]; then
		return 1
	fi
	SMOKE_DEPLOY_RECORD=$(docker exec "$DB_NAME" psql \
		-U docklands_smoke \
		-d docklands_smoke \
		-tAc "select a.\"applicationStatus\"::text || '|' || coalesce((select d.status::text from deployment d where d.\"applicationId\" = a.\"applicationId\" order by d.\"createdAt\" desc limit 1), '') from application a where a.\"appName\" = '${SMOKE_DEPLOY_APP_NAME}'")
	[ "$SMOKE_DEPLOY_RECORD" = "done|done" ]
}

check_deploy_smoke() {
	local ids
	local workspace_id
	local environment_id
	local application_id
	local application_data

	prepare_smoke_deploy_image

	trpc_post "workspaces.create" \
		'{"json":{"name":"Smoke Workspace","description":"Production image deploy smoke","env":""}}' \
		"$WORKSPACE_BODY" \
		"create smoke workspace"
	ids=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const workspaceId = data?.workspace?.workspaceId;
const environmentId = data?.environment?.environmentId;
if (!workspaceId || !environmentId) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
console.log(`${workspaceId}|${environmentId}`);
' "$WORKSPACE_BODY")
	workspace_id=${ids%%|*}
	environment_id=${ids#*|}
	if [ -z "$workspace_id" ] || [ -z "$environment_id" ]; then
		echo "Could not parse smoke workspace/environment IDs" >&2
		exit 1
	fi

	trpc_post "application.create" \
		"{\"json\":{\"name\":\"Smoke Deploy\",\"appName\":\"${SMOKE_DEPLOY_APP_BASE}\",\"description\":\"Production image deploy smoke\",\"environmentId\":\"${environment_id}\"}}" \
		"$APPLICATION_BODY" \
		"create smoke application"
	application_data=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const applicationId = data?.applicationId;
const appName = data?.appName;
if (!applicationId || !appName) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
console.log(`${applicationId}|${appName}`);
' "$APPLICATION_BODY")
	application_id=${application_data%%|*}
	SMOKE_DEPLOY_APP_NAME=${application_data#*|}
	if [ -z "$application_id" ] || [ -z "$SMOKE_DEPLOY_APP_NAME" ]; then
		echo "Could not parse smoke application ID/name" >&2
		exit 1
	fi

	trpc_post "application.saveDockerProvider" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"dockerImage\":\"${SMOKE_DEPLOY_IMAGE}\",\"username\":null,\"password\":null,\"registryUrl\":null}}" \
		"$DOCKER_PROVIDER_BODY" \
		"save smoke Docker provider"
	trpc_post "application.update" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"command\":\"sleep\",\"args\":[\"3600\"]}}" \
		"$APPLICATION_UPDATE_BODY" \
		"update smoke application command"
	trpc_post "application.deploy" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"title\":\"Smoke deploy\",\"description\":\"Production image deploy smoke\"}}" \
		"$DEPLOY_BODY" \
		"deploy smoke application"

	wait_for "smoke application service" deployed_service_ready
	wait_for "smoke deployment DB completion" deploy_record_done
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
	-e DOCKER_HOST="tcp://${DIND_NAME}:2375" \
	-e SWARM_ADVERTISE_ADDR=127.0.0.1 \
	"$IMAGE_REF" >/dev/null

APP_PORT=$(docker port "$APP_NAME" 3000/tcp | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1)
if [ -z "$APP_PORT" ]; then
	echo "Could not resolve mapped app port" >&2
	exit 1
fi

wait_for "Docklands readiness" check_ready

if [ "$RUN_OPERATOR_SMOKE" = "1" ]; then
	check_operator_smoke
fi

if [ "$RUN_DEPLOY_SMOKE" = "1" ]; then
	if [ "$RUN_OPERATOR_SMOKE" != "1" ]; then
		echo "DOCKLANDS_SMOKE_DEPLOY=1 requires DOCKLANDS_SMOKE_OPERATOR=1" >&2
		exit 1
	fi
	check_deploy_smoke
fi

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

if [ "$RUN_OPERATOR_SMOKE" = "1" ]; then
	echo "Docklands operator smoke passed for $IMAGE_REF"
	echo "  first owner: owner@docklands.local"
	echo "  default ingress mode: public -> tunnel -> public"
	if [ "$RUN_DEPLOY_SMOKE" = "1" ]; then
		echo "  smoke deploy service: $SMOKE_DEPLOY_APP_NAME"
		echo "  smoke deploy image: $SMOKE_DEPLOY_IMAGE"
		echo "  smoke deploy record: $SMOKE_DEPLOY_RECORD"
	fi
else
	echo "Docklands image smoke passed for $IMAGE_REF"
fi
echo "  readiness: http://127.0.0.1:${APP_PORT}/api/ready"
echo "  dind swarm: $SWARM_STATE"
echo "  docklands-network: $NETWORK_STATE"
