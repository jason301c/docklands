#!/usr/bin/env bash
# Docklands verify harness — shared assertion library.
#
# These are the proven install/operator/deploy/backup assertions, lifted from the
# old smoke scripts and made substrate-agnostic. The orchestrator (verify.sh)
# brings up a substrate (a portable Docker-in-Docker sandbox, or an already-
# running instance on a real host / replica) and defines a small set of hook
# functions; everything below runs identically on top of either.
#
# Hooks a substrate MUST define before calling these:
#   VERIFY_BASE_URL                 Base URL of the Docklands app (http://host:port)
#   verify_managed_docker <args>    Run `docker <args>` against the managed daemon
#   verify_read_traefik_dynamic <app> <outfile>
#                                   Capture the generated Traefik dynamic config
# Optional hooks (assertions that use them are skipped when undefined):
#   VERIFY_TRAEFIK_URL              Base URL for the public Traefik :80 route check
#   verify_psql <sql>               Run a SQL query against the instance DB (prints result)

# --- temp-file registry -----------------------------------------------------

VERIFY_TMP_FILES=()

vrfy_mktemp() {
	local f
	f=$(mktemp)
	VERIFY_TMP_FILES+=("$f")
	printf '%s\n' "$f"
}

vrfy_cleanup_tmp() {
	if [ "${#VERIFY_TMP_FILES[@]}" -gt 0 ]; then
		rm -f "${VERIFY_TMP_FILES[@]}"
	fi
}

vrfy_init_state() {
	VRFY_READY_BODY=$(vrfy_mktemp)
	VRFY_REGISTER_BODY=$(vrfy_mktemp)
	VRFY_SIGNUP_BODY=$(vrfy_mktemp)
	VRFY_SESSION_BODY=$(vrfy_mktemp)
	VRFY_SECOND_SIGNUP_BODY=$(vrfy_mktemp)
	VRFY_HOME_HEADERS=$(vrfy_mktemp)
	VRFY_REGISTER_AFTER_HEADERS=$(vrfy_mktemp)
	VRFY_INGRESS_UPDATE_BODY=$(vrfy_mktemp)
	VRFY_INGRESS_SETTINGS_BODY=$(vrfy_mktemp)
	VRFY_WORKSPACE_BODY=$(vrfy_mktemp)
	VRFY_APPLICATION_BODY=$(vrfy_mktemp)
	VRFY_DOCKER_PROVIDER_BODY=$(vrfy_mktemp)
	VRFY_DOMAIN_BODY=$(vrfy_mktemp)
	VRFY_DEPLOY_BODY=$(vrfy_mktemp)
	VRFY_DOMAIN_CONFIG_BODY=$(vrfy_mktemp)
	VRFY_TRAEFIK_BODY=$(vrfy_mktemp)
	VRFY_DESTINATION_BODY=$(vrfy_mktemp)
	VRFY_BACKUP_BODY=$(vrfy_mktemp)
	VRFY_BACKUP_RUN_BODY=$(vrfy_mktemp)
	VRFY_BACKUP_LIST_BODY=$(vrfy_mktemp)
	VRFY_COOKIE_JAR=$(vrfy_mktemp)

	VRFY_DEPLOY_APP_NAME=""
	VRFY_DEPLOY_HOST=""
}

# --- generic helpers --------------------------------------------------------

VERIFY_WAIT_SECONDS=${DOCKLANDS_VERIFY_TIMEOUT_SECONDS:-300}

vrfy_wait_for() {
	local label=$1
	shift
	local deadline=$((SECONDS + VERIFY_WAIT_SECONDS))
	until "$@"; do
		if [ "$SECONDS" -ge "$deadline" ]; then
			echo "Timed out waiting for $label after ${VERIFY_WAIT_SECONDS}s" >&2
			return 1
		fi
		sleep 2
	done
}

vrfy_expect_status() {
	local label=$1 expected=$2 actual=$3 response_file=$4
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

vrfy_trpc_post() {
	local procedure=$1 body=$2 output_file=$3 label=$4 status
	status=$(curl -sS -o "$output_file" -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${VERIFY_BASE_URL}/api/trpc/${procedure}" \
		--data "$body")
	vrfy_expect_status "$label" "200" "$status" "$output_file"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.error) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$output_file"
}

# --- readiness + install ----------------------------------------------------

vrfy_check_ready() {
	local status
	status=$(curl -s -o "$VRFY_READY_BODY" -w "%{http_code}" \
		"${VERIFY_BASE_URL}/api/ready" || true)
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
' "$VRFY_READY_BODY"
}

# Assert Swarm is active and the docklands-network overlay exists on the managed
# daemon. This is the heart of "the install path produced a real server."
vrfy_assert_swarm_and_network() {
	local swarm_state network_state
	swarm_state=$(verify_managed_docker info \
		--format '{{.Swarm.LocalNodeState}}/{{.Swarm.ControlAvailable}}')
	if [ "$swarm_state" != "active/true" ]; then
		echo "Expected managed Swarm active/true, got $swarm_state" >&2
		return 1
	fi
	network_state=$(verify_managed_docker network inspect docklands-network \
		--format '{{.Driver}}/{{.Scope}}')
	if [ "$network_state" != "overlay/swarm" ]; then
		echo "Expected docklands-network overlay/swarm, got $network_state" >&2
		return 1
	fi
	echo "  swarm: $swarm_state"
	echo "  docklands-network: $network_state"
}

# --- operator bootstrap -----------------------------------------------------

VERIFY_OWNER_EMAIL=${DOCKLANDS_VERIFY_OWNER_EMAIL:-owner@docklands.local}
VERIFY_OWNER_PASSWORD=${DOCKLANDS_VERIFY_OWNER_PASSWORD:-docklands-owner-000000}

vrfy_assert_ingress_mode() {
	local expected=$1 status persisted_mode
	status=$(curl -sS -o "$VRFY_INGRESS_SETTINGS_BODY" -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" \
		"${VERIFY_BASE_URL}/api/trpc/settings.getWebServerSettings")
	vrfy_expect_status "read ingress settings" "200" "$status" "$VRFY_INGRESS_SETTINGS_BODY"
	node -e '
const fs = require("node:fs");
const expected = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const mode = body.result?.data?.json?.defaultIngressMode;
if (mode !== expected) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$VRFY_INGRESS_SETTINGS_BODY" "$expected"

	# When the substrate exposes the DB, also assert the value persisted.
	if declare -F verify_psql >/dev/null; then
		persisted_mode=$(verify_psql 'select "defaultIngressMode" from "webServerSettings" order by created_at asc limit 1')
		if [ "$persisted_mode" != "$expected" ]; then
			echo "Expected persisted default ingress mode $expected, got: $persisted_mode" >&2
			return 1
		fi
	fi
}

vrfy_update_ingress_mode() {
	local mode=$1 status
	status=$(curl -sS -o "$VRFY_INGRESS_UPDATE_BODY" -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${VERIFY_BASE_URL}/api/trpc/settings.updateDefaultIngressMode" \
		--data "{\"json\":{\"defaultIngressMode\":\"${mode}\"}}")
	vrfy_expect_status "update default ingress mode" "200" "$status" "$VRFY_INGRESS_UPDATE_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.result?.data?.json !== true) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$VRFY_INGRESS_UPDATE_BODY"
	vrfy_assert_ingress_mode "$mode"
}

# First-run owner bootstrap: register page, first signup creates owner + org,
# session works, home/register redirects, second signup is rejected, ingress
# mode round-trips public -> tunnel -> public.
vrfy_check_first_owner() {
	local status signup_payload
	status=$(curl -sS -o "$VRFY_REGISTER_BODY" -w "%{http_code}" \
		"${VERIFY_BASE_URL}/register")
	vrfy_expect_status "register page" "200" "$status" "$VRFY_REGISTER_BODY"
	node -e '
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[1], "utf8");
if (!html.includes("Set up Docklands") || !html.includes("Create account")) {
	console.error("Register page did not render the first-owner setup form");
	process.exit(1);
}
' "$VRFY_REGISTER_BODY"

	signup_payload=$(node -e '
const [email, password] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ email, password, name: "Owner", lastName: "User" }));
' "$VERIFY_OWNER_EMAIL" "$VERIFY_OWNER_PASSWORD")
	status=$(curl -sS -o "$VRFY_SIGNUP_BODY" -w "%{http_code}" \
		-c "$VRFY_COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${VERIFY_BASE_URL}/api/auth/sign-up/email" \
		--data "$signup_payload")
	vrfy_expect_status "first-owner signup" "200" "$status" "$VRFY_SIGNUP_BODY"
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
' "$VRFY_SIGNUP_BODY" "$VERIFY_OWNER_EMAIL"
	node -e '
const fs = require("node:fs");
const jar = fs.readFileSync(process.argv[1], "utf8");
if (!jar.split(/\r?\n/).some((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))) {
	console.error("Signup did not create an auth cookie");
	process.exit(1);
}
' "$VRFY_COOKIE_JAR"

	vrfy_assert_authenticated_session
	vrfy_assert_second_signup_rejected

	if declare -F verify_psql >/dev/null; then
		local bootstrap_record
		bootstrap_record=$(verify_psql 'select (select count(*) from organization) || '"'"'|'"'"' || (select count(*) from member where role = '"'"'owner'"'"') || '"'"'|'"'"' || coalesce((select o.name || '"'"'|'"'"' || m.role || '"'"'|'"'"' || u.email from organization o join member m on m.organization_id = o.id join "user" u on u.id = m.user_id limit 1), '"'"''"'"')')
		if [ "$bootstrap_record" != "1|1|Docklands|owner|${VERIFY_OWNER_EMAIL}" ]; then
			echo "Expected first-owner bootstrap DB row, got: $bootstrap_record" >&2
			return 1
		fi
	fi

	vrfy_assert_ingress_mode "public"
	vrfy_update_ingress_mode "tunnel"
	vrfy_update_ingress_mode "public"
}

# Existing-owner path (used by verify upgrade after a container replacement):
# the owner can still sign in, the session survives, redirects hold, and ingress
# settings are intact.
vrfy_check_existing_owner() {
	local status signin_payload
	signin_payload=$(node -e '
const [email, password] = process.argv.slice(1);
process.stdout.write(JSON.stringify({ email, password }));
' "$VERIFY_OWNER_EMAIL" "$VERIFY_OWNER_PASSWORD")
	status=$(curl -sS -o "$VRFY_SIGNUP_BODY" -w "%{http_code}" \
		-c "$VRFY_COOKIE_JAR" \
		-H "content-type: application/json" \
		-X POST \
		"${VERIFY_BASE_URL}/api/auth/sign-in/email" \
		--data "$signin_payload")
	vrfy_expect_status "existing-owner sign-in" "200" "$status" "$VRFY_SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof body.token !== "string" || body.user?.email !== expectedEmail) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$VRFY_SIGNUP_BODY" "$VERIFY_OWNER_EMAIL"

	vrfy_assert_authenticated_session
	vrfy_assert_ingress_mode "public"
}

vrfy_assert_authenticated_session() {
	local status
	status=$(curl -sS -o "$VRFY_SESSION_BODY" -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" \
		"${VERIFY_BASE_URL}/api/auth/get-session")
	vrfy_expect_status "auth session" "200" "$status" "$VRFY_SESSION_BODY"
	node -e '
const fs = require("node:fs");
const expectedEmail = process.argv[2];
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.user?.email !== expectedEmail || !body.session) {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$VRFY_SESSION_BODY" "$VERIFY_OWNER_EMAIL"

	status=$(curl -sS -D "$VRFY_HOME_HEADERS" -o /dev/null -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" "${VERIFY_BASE_URL}/")
	vrfy_expect_status "authenticated home redirect" "307" "$status" "$VRFY_HOME_HEADERS"
	node -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
if (!/^location:\s*\/dashboard\/workspace\s*$/im.test(headers)) {
	console.error(headers);
	process.exit(1);
}
' "$VRFY_HOME_HEADERS"

	status=$(curl -sS -D "$VRFY_REGISTER_AFTER_HEADERS" -o /dev/null -w "%{http_code}" \
		-b "$VRFY_COOKIE_JAR" "${VERIFY_BASE_URL}/register")
	vrfy_expect_status "post-bootstrap register redirect" "307" "$status" "$VRFY_REGISTER_AFTER_HEADERS"
	node -e '
const fs = require("node:fs");
const headers = fs.readFileSync(process.argv[1], "utf8");
if (!/^location:\s*\/\s*$/im.test(headers)) {
	console.error(headers);
	process.exit(1);
}
' "$VRFY_REGISTER_AFTER_HEADERS"
}

vrfy_assert_second_signup_rejected() {
	local status
	status=$(curl -sS -o "$VRFY_SECOND_SIGNUP_BODY" -w "%{http_code}" \
		-H "content-type: application/json" \
		-X POST \
		"${VERIFY_BASE_URL}/api/auth/sign-up/email" \
		--data '{"email":"second@docklands.local","password":"docklands-owner-000000","name":"Second","lastName":"User"}')
	vrfy_expect_status "second signup rejection" "400" "$status" "$VRFY_SECOND_SIGNUP_BODY"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.message !== "Admin is already created") {
	console.error(JSON.stringify(body, null, 2));
	process.exit(1);
}
' "$VRFY_SECOND_SIGNUP_BODY"
}

# --- deploy + ingress -------------------------------------------------------

VERIFY_DEPLOY_IMAGE=${DOCKLANDS_VERIFY_DEPLOY_IMAGE:-registry:2}

# Creates a workspace + application + Docker provider + public domain, deploys,
# and waits for the service, the DB deployment record (when DB is exposed), and
# the generated Traefik dynamic config. Sets VRFY_DEPLOY_APP_NAME/HOST.
vrfy_deploy_app() {
	local app_base=$1 ids workspace_id environment_id application_id application_data
	app_base=$(printf "%s" "$app_base" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-42)
	[ -n "$app_base" ] || app_base="verify-deploy"

	vrfy_trpc_post "workspaces.create" \
		'{"json":{"name":"Verify Workspace","description":"Docklands verify","env":""}}' \
		"$VRFY_WORKSPACE_BODY" "create verify workspace"
	ids=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const workspaceId = data?.workspace?.workspaceId;
const environmentId = data?.environment?.environmentId;
if (!workspaceId || !environmentId) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
console.log(`${workspaceId}|${environmentId}`);
' "$VRFY_WORKSPACE_BODY")
	workspace_id=${ids%%|*}
	environment_id=${ids#*|}
	[ -n "$workspace_id" ] && [ -n "$environment_id" ] || { echo "Could not parse verify workspace/environment IDs" >&2; return 1; }

	vrfy_trpc_post "application.create" \
		"{\"json\":{\"name\":\"Verify Deploy\",\"appName\":\"${app_base}\",\"description\":\"Docklands verify\",\"environmentId\":\"${environment_id}\"}}" \
		"$VRFY_APPLICATION_BODY" "create verify application"
	application_data=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const applicationId = data?.applicationId;
const appName = data?.appName;
if (!applicationId || !appName) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
console.log(`${applicationId}|${appName}`);
' "$VRFY_APPLICATION_BODY")
	application_id=${application_data%%|*}
	VRFY_DEPLOY_APP_NAME=${application_data#*|}
	[ -n "$application_id" ] && [ -n "$VRFY_DEPLOY_APP_NAME" ] || { echo "Could not parse verify application ID/name" >&2; return 1; }
	VRFY_DEPLOY_HOST="${VRFY_DEPLOY_APP_NAME}.docklands.localhost"

	vrfy_trpc_post "application.saveDockerProvider" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"dockerImage\":\"${VERIFY_DEPLOY_IMAGE}\",\"username\":null,\"password\":null,\"registryUrl\":null}}" \
		"$VRFY_DOCKER_PROVIDER_BODY" "save verify Docker provider"
	vrfy_trpc_post "domain.create" \
		"{\"json\":{\"host\":\"${VRFY_DEPLOY_HOST}\",\"path\":\"/v2/\",\"port\":5000,\"https\":false,\"applicationId\":\"${application_id}\",\"certificateType\":\"none\",\"domainType\":\"application\",\"internalPath\":\"/v2/\",\"stripPath\":false,\"middlewares\":[],\"ingressMode\":\"public\"}}" \
		"$VRFY_DOMAIN_BODY" "create verify public domain"
	vrfy_trpc_post "application.deploy" \
		"{\"json\":{\"applicationId\":\"${application_id}\",\"title\":\"Verify deploy\",\"description\":\"Docklands verify\"}}" \
		"$VRFY_DEPLOY_BODY" "deploy verify application"

	vrfy_wait_for "verify application service" vrfy_service_running
	if declare -F verify_psql >/dev/null; then
		vrfy_wait_for "verify deployment DB completion" vrfy_deploy_record_done
	fi
	vrfy_wait_for "verify domain config" vrfy_domain_config_ready
}

vrfy_service_running() {
	[ -n "$VRFY_DEPLOY_APP_NAME" ] || return 1
	verify_managed_docker service inspect "$VRFY_DEPLOY_APP_NAME" >/dev/null 2>&1 || return 1
	verify_managed_docker service ps "$VRFY_DEPLOY_APP_NAME" \
		--filter desired-state=running \
		--format '{{.CurrentState}} {{.Error}}' 2>/dev/null | grep -q '^Running'
}

vrfy_deploy_record_done() {
	[ -n "$VRFY_DEPLOY_APP_NAME" ] || return 1
	local record
	record=$(verify_psql "select a.\"applicationStatus\"::text || '|' || coalesce((select d.status::text from deployment d where d.\"applicationId\" = a.\"applicationId\" order by d.\"createdAt\" desc limit 1), '') from application a where a.\"appName\" = '${VRFY_DEPLOY_APP_NAME}'")
	[ "$record" = "done|done" ]
}

vrfy_domain_config_ready() {
	[ -n "$VRFY_DEPLOY_HOST" ] || return 1
	verify_read_traefik_dynamic "$VRFY_DEPLOY_APP_NAME" "$VRFY_DOMAIN_CONFIG_BODY" || return 1
	grep -Fq "Host(\`${VRFY_DEPLOY_HOST}\`)" "$VRFY_DOMAIN_CONFIG_BODY" &&
		grep -Fq "PathPrefix(\`/v2/\`)" "$VRFY_DOMAIN_CONFIG_BODY" &&
		grep -Fq "url: http://${VRFY_DEPLOY_APP_NAME}:5000" "$VRFY_DOMAIN_CONFIG_BODY"
}

# Real end-to-end ingress: Traefik on the host actually routes the host header to
# the deployed container over port 80. Only meaningful when VERIFY_TRAEFIK_URL is
# set (a real host/replica), so the sandbox skips it.
vrfy_assert_traefik_route() {
	[ -n "${VERIFY_TRAEFIK_URL:-}" ] || return 0
	vrfy_wait_for "Traefik public route" vrfy_traefik_route_ready
	echo "  traefik route: ${VERIFY_TRAEFIK_URL}/v2/ (Host: ${VRFY_DEPLOY_HOST}) -> 200"
}

vrfy_traefik_route_ready() {
	local status
	status=$(curl -sS -o "$VRFY_TRAEFIK_BODY" -w "%{http_code}" \
		-H "Host: ${VRFY_DEPLOY_HOST}" \
		"${VERIFY_TRAEFIK_URL}/v2/" || true)
	[ "$status" = "200" ]
}

# --- whole-instance backup --------------------------------------------------

VERIFY_S3_ENDPOINT=${DOCKLANDS_VERIFY_S3_ENDPOINT:-}
VERIFY_S3_ACCESS_KEY=${DOCKLANDS_VERIFY_S3_ACCESS_KEY:-docklandsminio}
VERIFY_S3_SECRET_KEY=${DOCKLANDS_VERIFY_S3_SECRET_KEY:-docklandsminiosecret}
VERIFY_S3_BUCKET=${DOCKLANDS_VERIFY_S3_BUCKET:-docklands-verify}
VERIFY_S3_PROVIDER=${DOCKLANDS_VERIFY_S3_PROVIDER:-Minio}
VERIFY_S3_REGION=${DOCKLANDS_VERIFY_S3_REGION:-us-east-1}

# Creates an S3 destination, a whole-instance (web-server) backup, runs it, and
# confirms a backup zip landed in object storage. Requires the substrate to have
# set up an S3 endpoint (VERIFY_S3_ENDPOINT) and to define verify_find_backups.
vrfy_check_backup() {
	local prefix destination_id backup_data backup_id backup_app_name backup_objects
	if [ -z "$VERIFY_S3_ENDPOINT" ] || ! declare -F verify_find_backups >/dev/null; then
		echo "verify backup requires an S3 endpoint substrate (VERIFY_S3_ENDPOINT + verify_find_backups)." >&2
		return 1
	fi

	vrfy_trpc_post "destination.create" \
		"{\"json\":{\"name\":\"Verify MinIO\",\"provider\":\"${VERIFY_S3_PROVIDER}\",\"accessKey\":\"${VERIFY_S3_ACCESS_KEY}\",\"secretAccessKey\":\"${VERIFY_S3_SECRET_KEY}\",\"bucket\":\"${VERIFY_S3_BUCKET}\",\"region\":\"${VERIFY_S3_REGION}\",\"endpoint\":\"${VERIFY_S3_ENDPOINT}\",\"additionalFlags\":[]}}" \
		"$VRFY_DESTINATION_BODY" "create verify backup destination"
	destination_id=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const destinationId = body.result?.data?.json?.destinationId;
if (!destinationId) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
console.log(destinationId);
' "$VRFY_DESTINATION_BODY")
	[ -n "$destination_id" ] || { echo "Could not parse verify destination ID" >&2; return 1; }

	prefix=$(printf "verify-%s" "${DOCKLANDS_VERIFY_ID:-$$}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_.-]+/-/g; s/^-+//; s/-+$//' | cut -c1-60)
	[ -n "$prefix" ] || prefix="verify"

	vrfy_trpc_post "backup.create" \
		"{\"json\":{\"schedule\":\"0 0 * * *\",\"enabled\":false,\"prefix\":\"${prefix}\",\"destinationId\":\"${destination_id}\",\"keepLatestCount\":1,\"database\":\"docklands\",\"databaseId\":null,\"serviceDatabaseId\":null,\"databaseType\":\"web-server\",\"userId\":null,\"backupType\":\"database\",\"composeId\":null,\"serviceName\":null,\"metadata\":null}}" \
		"$VRFY_BACKUP_BODY" "create verify whole-instance backup"
	backup_data=$(node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const data = body.result?.data?.json;
const backupId = data?.backupId;
const appName = data?.appName;
if (!backupId || !appName) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
console.log(`${backupId}|${appName}`);
' "$VRFY_BACKUP_BODY")
	backup_id=${backup_data%%|*}
	backup_app_name=${backup_data#*|}
	[ -n "$backup_id" ] && [ -n "$backup_app_name" ] || { echo "Could not parse verify backup ID/appName" >&2; return 1; }

	vrfy_trpc_post "backup.manualBackupWebServer" \
		"{\"json\":{\"backupId\":\"${backup_id}\"}}" \
		"$VRFY_BACKUP_RUN_BODY" "run verify whole-instance backup"
	node -e '
const fs = require("node:fs");
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (body.result?.data?.json !== true) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
' "$VRFY_BACKUP_RUN_BODY"

	backup_objects=$(verify_find_backups "${backup_app_name}/${prefix}" | tee "$VRFY_BACKUP_LIST_BODY")
	if ! printf "%s\n" "$backup_objects" | grep -Eq '\.zip$'; then
		echo "Expected object storage to contain a whole-instance backup zip" >&2
		return 1
	fi
	echo "  backup: ${VERIFY_S3_BUCKET}/${backup_app_name}/${prefix} contains a .zip"
}
