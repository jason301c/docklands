#!/bin/bash
set -euo pipefail

# Host-level v0.1.0 release smoke. Run only on a disposable Docker host where
# Docklands has already been installed, started, and pointed at the host Docker
# daemon. The script bootstraps the first owner, deploys a known container image,
# assigns a public domain, and verifies Traefik can route to it over port 80.

BASE_URL=${DOCKLANDS_HOST_SMOKE_BASE_URL:-http://127.0.0.1:3000}
TRAEFIK_URL=${DOCKLANDS_HOST_SMOKE_TRAEFIK_URL:-http://127.0.0.1}
WAIT_SECONDS=${DOCKLANDS_HOST_SMOKE_TIMEOUT_SECONDS:-300}
SMOKE_ID=${DOCKLANDS_HOST_SMOKE_ID:-$(date +%s)-$$}
SMOKE_IMAGE=${DOCKLANDS_HOST_SMOKE_IMAGE:-registry:2}
OWNER_EMAIL=${DOCKLANDS_HOST_SMOKE_OWNER_EMAIL:-owner@docklands.local}
OWNER_PASSWORD=${DOCKLANDS_HOST_SMOKE_OWNER_PASSWORD:-docklands-owner-000000}
EXISTING_OWNER=${DOCKLANDS_HOST_SMOKE_EXISTING_OWNER:-}
RUN_BACKUP_SMOKE=${DOCKLANDS_HOST_SMOKE_BACKUP:-}
S3_ENDPOINT=${DOCKLANDS_HOST_SMOKE_S3_ENDPOINT:-http://docklands-smoke-minio:9000}
S3_ACCESS_KEY=${DOCKLANDS_HOST_SMOKE_S3_ACCESS_KEY:-docklandsminio}
S3_SECRET_KEY=${DOCKLANDS_HOST_SMOKE_S3_SECRET_KEY:-docklandsminiosecret}
S3_BUCKET=${DOCKLANDS_HOST_SMOKE_S3_BUCKET:-docklands-smoke}
S3_PROVIDER=${DOCKLANDS_HOST_SMOKE_S3_PROVIDER:-Minio}
S3_REGION=${DOCKLANDS_HOST_SMOKE_S3_REGION:-us-east-1}
MC_IMAGE=${DOCKLANDS_HOST_SMOKE_MC_IMAGE:-minio/mc:RELEASE.2026-05-21T01-59-54Z}

BASE_URL=${BASE_URL%/}
TRAEFIK_URL=${TRAEFIK_URL%/}
SMOKE_DEPLOY_APP_BASE=$(printf "smoke-%s" "$SMOKE_ID" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-42)
if [ -z "$SMOKE_DEPLOY_APP_BASE" ]; then
	SMOKE_DEPLOY_APP_BASE="smoke-deploy"
fi
SMOKE_DEPLOY_APP_NAME=""
SMOKE_DEPLOY_HOST=""

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
DOMAIN_BODY=$(mktemp)
DEPLOY_BODY=$(mktemp)
DOMAIN_CONFIG_BODY=$(mktemp)
TRAEFIK_BODY=$(mktemp)
DESTINATION_BODY=$(mktemp)
BACKUP_BODY=$(mktemp)
BACKUP_RUN_BODY=$(mktemp)
BACKUP_LIST_BODY=$(mktemp)
COOKIE_JAR=$(mktemp)

print_diagnostics() {
	echo "Docklands host operator smoke failed." >&2
	for file in \
		"$READY_BODY" \
		"$SIGNUP_BODY" \
		"$SECOND_SIGNUP_BODY" \
		"$INGRESS_UPDATE_BODY" \
		"$INGRESS_SETTINGS_BODY" \
		"$WORKSPACE_BODY" \
		"$APPLICATION_BODY" \
		"$DOCKER_PROVIDER_BODY" \
		"$DOMAIN_BODY" \
		"$DEPLOY_BODY" \
		"$DOMAIN_CONFIG_BODY" \
		"$TRAEFIK_BODY" \
		"$DESTINATION_BODY" \
		"$BACKUP_BODY" \
		"$BACKUP_RUN_BODY" \
		"$BACKUP_LIST_BODY"; do
		if [ -s "$file" ]; then
			echo "----- $(basename "$file") -----" >&2
			head -c 2000 "$file" >&2
			echo >&2
		fi
	done
	if [ -n "$SMOKE_DEPLOY_APP_NAME" ]; then
		echo "----- smoke deploy service state -----" >&2
		docker service ps "$SMOKE_DEPLOY_APP_NAME" --no-trunc >&2 || true
		echo "----- smoke deploy service logs -----" >&2
		docker service logs --tail 100 "$SMOKE_DEPLOY_APP_NAME" >&2 || true
	fi
	if docker ps -a --format '{{.Names}}' | grep -Fxq docklands-traefik; then
		echo "----- docklands-traefik logs -----" >&2
		docker logs --tail 100 docklands-traefik >&2 || true
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
		"$DOMAIN_BODY" \
		"$DEPLOY_BODY" \
		"$DOMAIN_CONFIG_BODY" \
		"$TRAEFIK_BODY" \
		"$DESTINATION_BODY" \
		"$BACKUP_BODY" \
		"$BACKUP_RUN_BODY" \
		"$BACKUP_LIST_BODY" \
		"$COOKIE_JAR"
	if [ "${DOCKLANDS_HOST_SMOKE_KEEP:-}" = "1" ]; then
		echo "Keeping smoke service because DOCKLANDS_HOST_SMOKE_KEEP=1:" >&2
		echo "  $SMOKE_DEPLOY_APP_NAME" >&2
		exit "$status"
	fi
	if [ -n "$SMOKE_DEPLOY_APP_NAME" ]; then
		docker service rm "$SMOKE_DEPLOY_APP_NAME" >/dev/null 2>&1 || true
	fi
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
		"${BASE_URL}/api/trpc/${procedure}" \
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

check_ready() {
	local status

	status=$(curl -sS -o "$READY_BODY" -w "%{http_code}" \
		"${BASE_URL}/api/ready" || true)
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

assert_ingress_mode() {
	local expected=$1
	local status

	status=$(curl -sS -o "$INGRESS_SETTINGS_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"${BASE_URL}/api/trpc/settings.getWebServerSettings")
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
}

update_ingress_mode() {
	local mode=$1
	local status

	status=$(curl -sS -o "$INGRESS_UPDATE_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${BASE_URL}/api/trpc/settings.updateDefaultIngressMode" \
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

check_first_owner() {
	local status
	local signup_payload

	status=$(curl -sS -o "$REGISTER_BODY" -w "%{http_code}" \
		"${BASE_URL}/register")
	expect_status "register page" "200" "$status" "$REGISTER_BODY"
	node -e '
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[1], "utf8");
if (!html.includes("Set up Docklands") || !html.includes("Create account")) {
	console.error("Register page did not render the first-owner setup form");
	process.exit(1);
}
' "$REGISTER_BODY"

	signup_payload=$(node -e '
const [email, password] = process.argv.slice(1);
process.stdout.write(JSON.stringify({
	email,
	password,
	name: "Owner",
	lastName: "User",
}));
' "$OWNER_EMAIL" "$OWNER_PASSWORD")
	status=$(curl -sS -o "$SIGNUP_BODY" -w "%{http_code}" \
		-c "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${BASE_URL}/api/auth/sign-up/email" \
		--data "$signup_payload")
	expect_status "first-owner signup" "200" "$status" "$SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (
	typeof body.token !== "string" ||
	body.user?.email !== expectedEmail ||
	body.user?.name !== "Owner" ||
	body.user?.lastName !== "User"
) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SIGNUP_BODY" "$OWNER_EMAIL"
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
		"${BASE_URL}/api/auth/get-session")
	expect_status "auth session" "200" "$status" "$SESSION_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.user?.email !== expectedEmail || !body.session) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SESSION_BODY" "$OWNER_EMAIL"

	status=$(curl -sS -D "$HOME_HEADERS" -o /dev/null -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"${BASE_URL}/")
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
		"${BASE_URL}/register")
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
		"${BASE_URL}/api/auth/sign-up/email" \
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

	assert_ingress_mode "public"
	update_ingress_mode "tunnel"
	update_ingress_mode "public"
}

check_existing_owner() {
	local status
	local signin_payload

	signin_payload=$(node -e '
const [email, password] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ email, password }));
' "$OWNER_EMAIL" "$OWNER_PASSWORD")
	status=$(curl -sS -o "$SIGNUP_BODY" -w "%{http_code}" \
		-c "$COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${BASE_URL}/api/auth/sign-in/email" \
		--data "$signin_payload")
	expect_status "existing-owner sign-in" "200" "$status" "$SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (
	typeof body.token !== "string" ||
	body.user?.email !== expectedEmail
) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SIGNUP_BODY" "$OWNER_EMAIL"

	status=$(curl -sS -o "$SESSION_BODY" -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"${BASE_URL}/api/auth/get-session")
	expect_status "auth session after restart" "200" "$status" "$SESSION_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.user?.email !== expectedEmail || !body.session) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$SESSION_BODY" "$OWNER_EMAIL"

	status=$(curl -sS -D "$HOME_HEADERS" -o /dev/null -w "%{http_code}" \
		-b "$COOKIE_JAR" \
		"${BASE_URL}/")
	expect_status "authenticated home redirect after restart" "307" "$status" \
		"$HOME_HEADERS"
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
		"${BASE_URL}/register")
	expect_status "post-restart register redirect" "307" "$status" \
		"$REGISTER_AFTER_HEADERS"
	node -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
if (!/^location:\s*\/\s*$/im.test(headers)) {
	console.error(headers);
	process.exit(1);
}
' "$REGISTER_AFTER_HEADERS"

	assert_ingress_mode "public"
	update_ingress_mode "tunnel"
	update_ingress_mode "public"
}

deployed_service_ready() {
	if [ -z "$SMOKE_DEPLOY_APP_NAME" ]; then
		return 1
	fi
	docker service inspect "$SMOKE_DEPLOY_APP_NAME" >/dev/null 2>&1 || return 1
	docker service ps "$SMOKE_DEPLOY_APP_NAME" \
		--filter desired-state=running \
		--format '{{.CurrentState}} {{.Error}}' 2>/dev/null | grep -q '^Running'
}

domain_config_ready() {
	if [ -z "$SMOKE_DEPLOY_HOST" ]; then
		return 1
	fi
	cat "/etc/docklands/traefik/dynamic/${SMOKE_DEPLOY_APP_NAME}.yml" \
		>"$DOMAIN_CONFIG_BODY" 2>/dev/null || return 1
	grep -Fq "Host(\`${SMOKE_DEPLOY_HOST}\`)" "$DOMAIN_CONFIG_BODY" &&
		grep -Fq "PathPrefix(\`/v2/\`)" "$DOMAIN_CONFIG_BODY" &&
		grep -Fq "url: http://${SMOKE_DEPLOY_APP_NAME}:5000" \
			"$DOMAIN_CONFIG_BODY"
}

traefik_route_ready() {
	local status

	status=$(curl -sS -o "$TRAEFIK_BODY" -w "%{http_code}" \
		-H "Host: ${SMOKE_DEPLOY_HOST}" \
		"${TRAEFIK_URL}/v2/" || true)
	[ "$status" = "200" ]
}

check_deploy_and_ingress() {
	local ids
	local workspace_id
	local environment_id
	local application_id
	local application_data

	docker image inspect "$SMOKE_IMAGE" >/dev/null 2>&1 || docker pull "$SMOKE_IMAGE"

	trpc_post "workspaces.create" \
		'{"json":{"name":"Smoke Workspace","description":"Host operator smoke","env":""}}' \
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
		"{\"json\":{\"name\":\"Smoke Deploy\",\"appName\":\"${SMOKE_DEPLOY_APP_BASE}\",\"description\":\"Host operator smoke\",\"environmentId\":\"${environment_id}\"}}" \
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
	SMOKE_DEPLOY_HOST="${SMOKE_DEPLOY_APP_NAME}.docklands.localhost"

	trpc_post "application.saveDockerProvider" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"dockerImage\":\"${SMOKE_IMAGE}\",\"username\":null,\"password\":null,\"registryUrl\":null}}" \
		"$DOCKER_PROVIDER_BODY" \
		"save smoke Docker provider"
	trpc_post "domain.create" \
		"{\"json\":{\"host\":\"${SMOKE_DEPLOY_HOST}\",\"path\":\"/v2/\",\"port\":5000,\"https\":false,\"applicationId\":\"${application_id}\",\"certificateType\":\"none\",\"domainType\":\"application\",\"internalPath\":\"/v2/\",\"stripPath\":false,\"middlewares\":[],\"ingressMode\":\"public\"}}" \
		"$DOMAIN_BODY" \
		"create smoke public domain"
	trpc_post "application.deploy" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"title\":\"Smoke deploy\",\"description\":\"Host operator smoke\"}}" \
		"$DEPLOY_BODY" \
		"deploy smoke application"

	wait_for "smoke application service" deployed_service_ready
	wait_for "smoke domain config" domain_config_ready
	wait_for "Traefik public route" traefik_route_ready
}

minio_find_backups() {
	local object_prefix=$1

	docker run --rm \
		--network docklands-network \
		--entrypoint sh \
		"$MC_IMAGE" \
		-c 'mc alias set smoke "$0" "$1" "$2" >/dev/null &&
			mc find "smoke/$3/$4" --name "*.zip"' \
		"$S3_ENDPOINT" \
		"$S3_ACCESS_KEY" \
		"$S3_SECRET_KEY" \
		"$S3_BUCKET" \
		"$object_prefix"
}

check_instance_backup() {
	local destination_id
	local backup_data
	local backup_id
	local backup_app_name
	local backup_prefix
	local backup_objects

	if [ "$RUN_BACKUP_SMOKE" != "1" ]; then
		return 0
	fi

	trpc_post "destination.create" \
		"{\"json\":{\"name\":\"Smoke MinIO\",\"provider\":\"${S3_PROVIDER}\",\"accessKey\":\"${S3_ACCESS_KEY}\",\"secretAccessKey\":\"${S3_SECRET_KEY}\",\"bucket\":\"${S3_BUCKET}\",\"region\":\"${S3_REGION}\",\"endpoint\":\"${S3_ENDPOINT}\",\"additionalFlags\":[]}}" \
		"$DESTINATION_BODY" \
		"create smoke backup destination"
	destination_id=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const destinationId = body.result?.data?.json?.destinationId;
if (!destinationId) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
console.log(destinationId);
' "$DESTINATION_BODY")
	if [ -z "$destination_id" ]; then
		echo "Could not parse smoke destination ID" >&2
		exit 1
	fi

	backup_prefix=$(printf "host-smoke-%s" "$SMOKE_ID" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_.-]+/-/g; s/^-+//; s/-+$//' | cut -c1-60)
	if [ -z "$backup_prefix" ]; then
		backup_prefix="host-smoke"
	fi

	trpc_post "backup.create" \
		"{\"json\":{\"schedule\":\"0 0 * * *\",\"enabled\":false,\"prefix\":\"${backup_prefix}\",\"destinationId\":\"${destination_id}\",\"keepLatestCount\":1,\"database\":\"docklands\",\"databaseId\":null,\"serviceDatabaseId\":null,\"databaseType\":\"web-server\",\"userId\":null,\"backupType\":\"database\",\"composeId\":null,\"serviceName\":null,\"metadata\":null}}" \
		"$BACKUP_BODY" \
		"create smoke whole-instance backup"
	backup_data=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const backupId = data?.backupId;
const appName = data?.appName;
if (!backupId || !appName) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
console.log(`${backupId}|${appName}`);
' "$BACKUP_BODY")
	backup_id=${backup_data%%|*}
	backup_app_name=${backup_data#*|}
	if [ -z "$backup_id" ] || [ -z "$backup_app_name" ]; then
		echo "Could not parse smoke backup ID/appName" >&2
		exit 1
	fi

	trpc_post "backup.manualBackupWebServer" \
		"{\"json\":{\"backupId\":\"${backup_id}\"}}" \
		"$BACKUP_RUN_BODY" \
		"run smoke whole-instance backup"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.result?.data?.json !== true) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$BACKUP_RUN_BODY"

	backup_objects=$(minio_find_backups "${backup_app_name}/${backup_prefix}" |
		tee "$BACKUP_LIST_BODY")
	if ! printf "%s\n" "$backup_objects" | grep -Eq '\.zip$'; then
		echo "Expected MinIO to contain a whole-instance backup zip" >&2
		exit 1
	fi
}

wait_for "Docklands readiness" check_ready
if [ "$EXISTING_OWNER" = "1" ]; then
	check_existing_owner
else
	check_first_owner
fi
check_deploy_and_ingress
check_instance_backup

echo "Docklands host operator smoke passed"
echo "  base URL: $BASE_URL"
echo "  Traefik URL: $TRAEFIK_URL"
echo "  first owner: $OWNER_EMAIL"
if [ "$EXISTING_OWNER" = "1" ]; then
	echo "  owner mode: existing owner sign-in"
else
	echo "  owner mode: first-owner bootstrap"
fi
echo "  default ingress mode: public -> tunnel -> public"
echo "  smoke deploy service: $SMOKE_DEPLOY_APP_NAME"
echo "  smoke image: $SMOKE_IMAGE"
echo "  smoke domain host: $SMOKE_DEPLOY_HOST"
if [ "$RUN_BACKUP_SMOKE" = "1" ]; then
	echo "  smoke backup bucket: $S3_BUCKET"
fi
