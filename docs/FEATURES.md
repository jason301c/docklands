# Docklands — Features & Implementation

Docklands is a self-hosted deployment control plane (a Dokploy fork) that you run
on your own VM. It deploys applications from Git, Docker images, and Docker
Compose; provisions and manages six database engines; routes traffic through
Traefik with automatic HTTPS; runs scheduled backups; manages
local and remote runtime workers; and exposes deployments, logs, metrics, and
terminals in real time.

This document is a catalogue of **what Docklands does** and **how each capability
is implemented**. It is written against the `canary` branch and reflects the
current code, not a roadmap. Paths are relative to `apps/docklands/` unless noted.

> **Scope note.** Docklands is single-tenant by design: you install it on your own
> machine, and there is exactly one organization per instance. There is no hosted
> "cloud" mode — every multi-tenant/`IS_CLOUD` code path was removed.

---

## Table of Contents

- [Architecture in one page](#architecture-in-one-page)
- [1. Identity, Organization & Access Control](#1-identity-organization--access-control)
- [2. Workspaces, Environments & the Canvas](#2-workspaces-environments--the-canvas)
- [3. Environment-variable cascade](#3-environment-variable-cascade)
- [4. Applications](#4-applications)
- [5. Build systems](#5-build-systems)
- [6. Git providers](#6-git-providers)
- [7. Docker Compose stacks](#7-docker-compose-stacks)
- [8. Template library](#8-template-library)
- [9. Managed databases](#9-managed-databases)
- [10. Backups, destinations & restore](#10-backups-destinations--restore)
- [11. Deployments, queue & rollbacks](#11-deployments-queue--rollbacks)
- [12. Preview environments](#12-preview-environments)
- [13. Ingress: domains, TLS, redirects, ports & basic-auth](#13-ingress-domains-tls-redirects-ports--basic-auth)
- [14. Runtime workers & the Swarm cluster](#14-runtime-workers--the-swarm-cluster)
- [15. Container runtime & Docker control](#15-container-runtime--docker-control)
- [16. Live logs, terminals & metrics](#16-live-logs-terminals--metrics)
- [17. Notifications](#17-notifications)
- [18. Mounts & volumes](#18-mounts--volumes)
- [19. Image registries](#19-image-registries)
- [20. SSH keys](#20-ssh-keys)
- [21. Tags](#21-tags)
- [22. Audit log](#22-audit-log)
- [23. Patches (file overrides)](#23-patches-file-overrides)
- [24. Settings surfaces](#24-settings-surfaces)
- [25. OpenAPI / REST API](#25-openapi--rest-api)
- [26. Ops & admin CLI entrypoints](#26-ops--admin-cli-entrypoints)
- [Appendix A — tRPC router map](#appendix-a--trpc-router-map)
- [Appendix B — Security boundaries & encryption](#appendix-b--security-boundaries--encryption)

---

## Architecture in one page

Docklands is a **single Node 24 process** that serves both the UI and the backend.
(Bun is only the package manager / task runner; the app always runs on Node.)

| Concern | Implementation |
| --- | --- |
| **HTTP + UI** | Custom Next.js 16 server (App Router, Turbopack) in `server/server.ts`, which also attaches the WebSocket servers and, in production, runs the startup sequence (directories, Traefik config, Swarm overlay network, backup schedules, deployment worker). |
| **API contract** | tRPC 11 (`server/api/`), 40 routers aggregated in `server/api/root.ts`, superjson + React Query on the client. A machine-readable OpenAPI surface is generated from the same routers. |
| **Persistence** | Drizzle ORM over `postgres.js`. Schema in `server/core/db/schema/`, migrations in `drizzle/`. Sensitive columns are encrypted at rest. |
| **Orchestration** | Docker Swarm services on a `docklands-network` overlay. Local Docker is reached via `dockerode`; remote runtime workers over SSH (`ssh2`). |
| **Ingress** | Traefik, configured by **generating YAML files on disk** (no Traefik API calls). |
| **Deploy queue** | In-memory, per-runtime-worker FIFO with per-service serialization, kept as a process-global singleton. **No Redis / BullMQ.** |
| **Identity & RBAC** | Better Auth (organization, admin, passkey, api-key plugins) plus a custom three-layer authorization model. |
| **Managed databases** | One unified `database` table discriminated by an `engine` column, driven by a single **engine registry** (`server/core/databases/registry.ts`). |

The product is **workspace-first**: `/dashboard/workspace` is the primary surface —
a project canvas for services, variables, deployments, domains, previews,
topology, and connection mapping.

---

## 1. Identity, Organization & Access Control

Authorization has three layers, all enforced in
`server/core/services/permission.ts` and wired through tRPC procedure factories in
`server/api/trpc.ts` (`publicProcedure`, `protectedProcedure`, `adminProcedure`,
and a `withPermission(resource, action)` factory).

### Single owner bootstrap & one organization per instance
- **What.** The first person to register becomes the **owner**; everyone else is
  invite-only. There is exactly one organization, and it cannot be created,
  switched, or deleted — it *is* the instance's identity (its name/logo show in the
  sidebar, edited via the `EditInstance` control).
- **How.** Better Auth is configured in `server/core/lib/auth.ts` with the
  organization plugin's `/organization/{create,update,delete}` paths disabled.
  `databaseHooks.user.create.before` gates signup (an invitation token in the
  `x-docklands-token` header, or "no owner exists yet"); `user.create.after`
  provisions the singleton organization and the owner `member` row on first signup.
  `session.create.before` stamps `activeOrganizationId` onto the session, so it is
  effectively a constant threaded through every router.

### Members & invitations
- **What.** Owners/admins invite members by email (48-hour expiry), cancel pending
  invitations, change member roles, and remove members. Role changes respect a
  hierarchy: the owner role is non-transferable, only an owner can change an
  admin, and admins cannot delete themselves or other admins.
- **How.** `server/api/routers/organization.ts` (`inviteMember`, `allInvitations`,
  `removeInvitation`, `updateMemberRole`, `active`) and `server/api/routers/user.ts`
  (list/get/remove users, `createUserWithCredentials`). Acceptance flows live under
  `app/(onboarding)/invitation/`. Tables: `member`, `invitation` (in
  `server/core/db/schema/account.ts`).

### Static roles
- **What.** Three built-in roles: **owner** (everything), **admin** (everything
  except updating/deleting the organization), **member** (read on org-level
  resources; CRUD on service-level resources, but only within explicitly granted
  resources).
- **How.** Defined as Better Auth access-control roles in
  `server/core/lib/access-control.ts`, validated against a canonical `statements`
  matrix (resource × action). `adminProcedure` restricts to owner/admin.

### Custom roles
- **What.** Owners/admins define named roles with arbitrary per-resource action
  grants, validated against the canonical statements. Members assigned a custom
  role inherit its permissions; deleting a role demotes its members to `member`.
- **How.** `server/api/routers/custom-role.ts` (CRUD + `membersByRole` +
  `getStatements`), stored in the `organization_role` table as JSON permission
  rows, resolved in `permission.ts` (`resolveRole` merges static + custom). UI at
  `app/dashboard/settings/roles/` — the role manager shows each role's member
  count and lets an admin drill into exactly which members hold it
  (`membersByRole`).

### Per-resource access grants
- **What.** Members can be granted access to specific workspaces, environments,
  services, git providers, and runtime workers. Owners/admins bypass scoping;
  members see only what they're granted.
- **How.** Normalized into the `member_resource_access` table
  (`resourceType ∈ {workspace, environment, service, gitProvider, runtimeWorker}` +
  `resourceId`). `permission.ts` helpers (`checkServiceAccess`,
  `checkEnvironmentAccess`, `syncMemberResourceAccess`, …) combine the role check
  with membership in the granted set. Edited via `user.assignPermissions`.

### Passkeys, API keys, password reset
- **What.** WebAuthn passkeys for passwordless sign-in; personal API keys
  (optionally rate-limited) for programmatic/REST access; email-based password
  reset; email verification.
- **How.** Better Auth `passkey()` and `apiKey()` plugins
  (`server/core/lib/auth.ts`); reset/verification emails rendered via React Email
  (`server/core/verification/`, `server/core/emails/`). API-key requests are
  authenticated by `validateRequestHeaders` (reads `x-api-key`, reconstructs the
  member/session). Password recovery is also possible from the CLI (see
  [§26](#26-ops--admin-cli-entrypoints)).

### Audit trail
- Logins, logouts, and meaningful mutations are recorded to the `audit_log` table
  (see [§22](#22-audit-log)). Audit writes are best-effort and never block the
  underlying operation.

---

## 2. Workspaces, Environments & the Canvas

### Workspaces (projects) and environments
- **What.** A **workspace** is a project; each workspace contains one or more
  **environments** (e.g. `production`, `staging`), and each environment holds the
  services. A default environment is created with the workspace; the default
  cannot be renamed or deleted. Workspaces and environments can be duplicated.
- **How.** `server/api/routers/workspace.ts` + `environment.ts`, services in
  `server/core/services/`, tables `workspace` and `environment`. Both tables carry
  an `env` text column (the base layers of the cascade — see
  [§3](#3-environment-variable-cascade)). Route shape:
  `/dashboard/workspace/[workspaceId]/[environmentId]`.

### The canvas
- **What.** An interactive graph of every service in an environment (applications,
  compose stacks, and all six database engines). Users drag nodes to position them,
  and the layout persists. Filters (by kind, status), sorts, and a `⌘/Ctrl-K`
  command bar for navigation/creation are built in. Per-service node menus expose
  deploy, logs, status, env, domains, backups, etc.
- **How.** UI in `components/dashboard/workspace/` (`environment-canvas.tsx`,
  `workspace-overview.tsx`, `actions/`, `manage/`). Layout is stored in
  `workspace_service_layout` (one row per `environmentId + serviceType +
  serviceId`, with `x/y/width/height`) via `workspaceGraph.updateNode`. Pure graph
  helpers (default positions, node resolution, orphan cleanup) live in
  `shared/workspace-graph.ts`; orphaned layout rows are pruned on load.

### Service-to-service connections + generated connection variables
- **What.** Draw a directed connection between two services. When a **managed
  database** is the source, its generated connection variables (`DATABASE_URL`,
  `POSTGRES_HOST`, …) are written into the **target's** env and refreshed on every
  deploy — so rotating a database password automatically reaches its consumers.
- **How.** Connections persist in `workspace_service_connection`
  (`workspaceGraph.connect` / `removeConnection`). Endpoints are normalized so the
  variable-exposing side (the database) is always the source
  (`normalizeWorkspaceConnectionEndpoints`). Variable recipes come from the engine
  registry (`connectionVars`). At deploy time, `refreshConnectionVariablesForDeploy`
  re-reads the source config, regenerates the variables, and upserts them into the
  target's service-level `env`; disconnecting retracts exactly that connection's
  keys.

### Topology grouping
- **What.** Connected services are visually grouped with a bounding box; a topology
  panel counts total/running/error services, connections, and unlinked services.
- **How.** `resolveWorkspaceConnectionGroups` (DFS over the connection graph into
  connected components) and `countWorkspaceTopology` in `shared/workspace-graph.ts`.

---

## 3. Environment-variable cascade

- **What.** Env vars layer **workspace → environment → service**, most-specific
  wins. A value set at the workspace level is inherited by every service in every
  environment unless a more specific layer overrides it. Generated connection
  variables live at the service layer, so they win over inherited values.
- **Reference syntax (escape hatch).** `${{workspace.X}}` and `${{environment.Y}}`
  pull a named value from a specific layer (useful to *rename* or *compose* a value
  as it cascades), and `${{X}}` resolves a bare name against the merged set. Unknown
  references throw at build time; the legacy `project.*` namespace is rejected with
  a guiding error.
- **How.** `prepareEnvironmentVariables(serviceEnv, workspaceEnv, environmentEnv)`
  in `server/core/utils/docker/utils.ts` parses each layer with `dotenv`, merges
  `{...workspace, ...environment, ...service}`, then resolves references. It is
  called by **every builder** (Nixpacks, Dockerfile, Heroku/Paketo/Railpack, static,
  compose, and the database builder) and by `getEnvironmentVariablesObject` /
  `prepareEnvironmentVariablesForShell`. Covered by the `__test__/env/` suite.

---

## 4. Applications

An **application** is a single deployable service. Source and build strategy are
chosen independently.

### Sources (`sourceType`)
`docker · git · github · gitlab · bitbucket · gitea · drop`

- **Git providers** (`github`/`gitlab`/`bitbucket`/`gitea`) — clone via the linked
  provider's credentials (see [§6](#6-git-providers)).
- **Generic Git** (`git`) — any HTTPS or SSH repo. SSH auth uses a referenced SSH
  key injected via a temp file + `GIT_SSH_COMMAND` (never exposed in the process
  list); submodules and custom SSH ports are supported.
- **Docker image** (`docker`) — deploy a prebuilt image from a public or private
  registry; private pulls use stored, encrypted credentials via a safe
  `docker login`. The build phase is skipped.
- **Drop** (`drop`) — upload a `.zip`; it is safely unzipped (path-traversal
  guarded, `__MACOSX` filtered, single root folder unwrapped) into the app's code
  dir, then built with the selected build strategy. Remote workers receive it over
  SFTP.

Implemented in `server/api/routers/application.ts`,
`server/core/services/application.ts`, with clone/pull helpers in
`server/core/utils/providers/` and unzip in `server/core/utils/builders/drop.ts`.
Schema: `server/core/db/schema/application.ts`.

### Configuration surface (selected fields)
- **Build**: `buildType`, `dockerfile` path, `dockerContextPath`,
  `dockerBuildStage` (multi-stage target), `publishDirectory` + `isStaticSpa`,
  builder version overrides.
- **Env & secrets** (encrypted): `env`, `buildArgs`, `buildSecrets`, plus
  `preview*` variants for PR previews.
- **Runtime/scaling**: `replicas`, `memoryReservation`/`memoryLimit`,
  `cpuReservation`/`cpuLimit`, `command`/`args` overrides.
- **Swarm tuning** (JSON): health check, restart policy, placement, update/rollback
  config, mode, labels, network, ulimits, stop grace period.
- **Ports & mounts**: managed as related records (see [§13](#13-ingress-domains-tls-redirects-ports--basic-auth) and [§18](#18-mounts--volumes)).
- **Registries**: separate `registryId`, `buildRegistryId`, `rollbackRegistryId`.
- **Auto-deploy**: `autoDeploy`, `triggerType` (`push`/`tag`), `refreshToken`
  (per-app webhook secret), `watchPaths` (glob filter).

### Auto-deploy & webhook deploys
- **Provider webhooks** auto-deploy on push/tag, gated by branch and `watchPaths`
  (matched with `micromatch`). GitHub deploy webhooks validate the
  `x-hub-signature-256` signature.
- **Webhook registration.** Only GitHub registers its webhook automatically (it is
  declared in the GitHub App manifest at connect time). GitLab, Gitea, Bitbucket,
  and generic Git use the **manual-webhook model**: copy the per-service deploy URL
  (shown in the service's Deployments view) into the repository's webhook settings.
  Docklands does not request webhook write scopes it never uses.
- **Refresh-token URL** — `POST/GET /api/deploy/[refreshToken]` lets any provider
  or custom Git server trigger a deploy without a first-class integration; the
  handler detects the provider from headers, validates branch + watch-paths, and
  enqueues a job. Handlers live in `server/web/deploy/`; watch-path logic in
  `server/core/utils/watch-paths/`.

---

## 5. Build systems

The orchestrator `server/core/utils/builders/index.ts` dispatches on `buildType`.
Every builder receives env from the [cascade](#3-environment-variable-cascade).

| `buildType` | Tool | Base / output | File |
| --- | --- | --- | --- |
| `nixpacks` | Nixpacks CLI (auto language detection) | language-detected image | `builders/nixpacks.ts` |
| `dockerfile` | `docker build` | your `FROM` image; supports `--target`, `--build-arg`, `--secret` | `builders/docker-file.ts` |
| `heroku_buildpacks` | `pack` CLI | `heroku/builder` (version configurable) | `builders/heroku.ts` |
| `paketo_buildpacks` | `pack` CLI | `paketobuildpacks/builder-jammy-full` | `builders/paketo.ts` |
| `railpack` | `docker buildx` with a Railpack plan | Railpack builder (unique builder name per build to avoid races) | `builders/railpack.ts` |
| `static` | generated Dockerfile | `nginx:alpine`, serving `publishDirectory` (SPA `try_files` fallback when `isStaticSpa`) | `builders/static.ts` |

Build **secrets** are passed to Dockerfile builds via BuildKit `--secret type=env`
(base64-encoded so they never appear in `ps`); build **args** map to `--build-arg`
(Dockerfile) or `--env` (buildpacks). After a successful build, the orchestrator
can push to the configured image registry.

---

## 6. Git providers

Configured under `/dashboard/settings/git-providers`; routers
`server/api/routers/{git-provider,github,gitlab,gitea,bitbucket}.ts`, clone/auth
helpers in `server/core/utils/providers/`, OAuth/setup callbacks in
`server/web/providers/` and `app/api/providers/*`. All tokens/keys are encrypted at
rest.

| Provider | Auth model | Clone auth | Token refresh | Self-hosted |
| --- | --- | --- | --- | --- |
| **GitHub** | GitHub **App** (app id + private key + installation id, via the app-manifest flow) | per-request installation token (Octokit AppAuth) | n/a (minted per request) | GitHub Enterprise via app |
| **GitLab** | **OAuth app** | HTTPS with access token (or SSH) | yes, before expiry | gitlab.com + self-hosted (`gitlabUrl`/`gitlabInternalUrl`) |
| **Gitea** | **OAuth app** | HTTPS with token (or SSH) | yes, before expiry | self-hosted (`giteaUrl`/`giteaInternalUrl`) |
| **Bitbucket** | **API token** + email | HTTPS basic (`email:token`) | n/a | Bitbucket Cloud |
| **Generic Git** | SSH key / HTTPS URL | SSH temp-file key or plain HTTPS | n/a | any |

All providers support listing repos/branches and auto-deploy on push (filtered by
branch + watch-paths). GitHub registers its push webhook automatically via the App
manifest; the others use the manual-webhook model (paste the deploy URL shown in
the Deployments view). GitHub additionally drives PR
[preview environments](#12-preview-environments) — the only provider that does —
and can require collaborator permissions for PR authors.

---

## 7. Docker Compose stacks

- **What.** Deploy a multi-service stack from Git (any of the five providers),
  generic Git, or raw inline YAML. Choose the deploy mode: **`docker-compose`**
  (single host, `docker compose up`) or **`stack`** (Swarm,
  `docker stack deploy --prune --with-registry-auth`). Optional **isolated
  deployment** (dedicated network, Traefik attached) and **randomization** (hashed
  suffixes on service/volume/network names to avoid collisions). Per-stack env
  injection follows the cascade; a `command` override can replace the default
  invocation entirely.
- **How.** `server/api/routers/compose.ts` + `server/core/services/compose.ts`;
  command construction in `server/core/utils/builders/compose.ts` (writes a
  generated `.env`, injects domain labels, optionally creates the isolated network,
  then runs the compose/stack command locally via `execAsync` or on a remote worker
  via `execAsyncRemote`). Schema: `server/core/db/schema/compose.ts` (`sourceType`,
  `composeType`, `composeFile`/`composePath`, `randomize`/`isolatedDeployment`/
  `suffix`, `autoDeploy`/`triggerType`/`watchPaths`, encrypted `env`).

---

## 8. Template library

- **What.** A one-click catalogue (hundreds of community compose templates) for
  apps and databases. Selecting a template provisions a ready-to-run compose
  service: secrets are generated, domains and file mounts are created, and any
  databases inside the stack are promoted to first-class managed services.
- **How.**
  - **Data**: `templates/` holds the compose YAMLs (each with `#`-comment headers:
    `slogan`, `category`, `tags`, `logo`, `port`, …) plus `service-templates*.json`
    indexes; icons in `public/templates/svgs/`.
  - **Logic**: `server/core/templates/` loads the catalogue (`catalog.ts`) and
    instantiates templates (`processors.ts`), resolving `SERVICE_*` magic variables
    (`SERVICE_FQDN_*` → a generated domain, `SERVICE_PASSWORD_*` → a generated
    secret, base64/hex/user variants, Supabase keys, …) with per-key caching. The
    result carries the mutated compose, env lines, domains, mounts, and detected
    databases.
  - **Database detection bridge**: `server/core/databases/detection.ts` inspects each
    service's image **and** context (ports, env keys, healthcheck signals; rejects
    app-like services) to identify an engine, then writes a `service_database` row
    (schema `server/core/db/schema/service-database.ts`, router
    `service-database.ts`). Those rows gain managed connection info and backups.
  - **Action**: `components/dashboard/workspace/actions/add-template.tsx` →
    `compose` router → `processComposeTemplate` → `createComposeByTemplate` →
    persist mounts/domains/service-databases → deploy.

---

## 9. Managed databases

All six engines share **one** `database` table (discriminated by `engine`, with
engine-specific credentials in an encrypted `config` jsonb), **one** router
(`server/api/routers/database.ts`), **one** service
(`server/core/services/database.ts`), **one** builder
(`server/core/utils/databases/build.ts`), and **one** UI tree
(`components/dashboard/database-service/`). The single source of truth for each
engine is the **registry** (`server/core/databases/registry.ts`) — adding an engine
is a registry entry, not new schema/router/UI.

| Engine | Default image | Port | Connection variables | Logical backup |
| --- | --- | --- | --- | --- |
| **PostgreSQL** | `postgres:18` | 5432 | `DATABASE_URL`, `POSTGRES_HOST/DB/USER/PASSWORD` | `pg_dump` ✓ |
| **MySQL** | `mysql:8` | 3306 | `DATABASE_URL`, `MYSQL_HOST/DATABASE/USER/PASSWORD` | `mysqldump` ✓ |
| **MariaDB** | `mariadb:11` | 3306 | `DATABASE_URL`, `MARIADB_HOST/DATABASE/USER/PASSWORD` | `mariadb-dump` ✓ |
| **MongoDB** | `mongo:8` | 27017 | `MONGO_URL` (`?authSource=admin`), `MONGO_HOST/USER/PASSWORD` | `mongodump` ✓ |
| **Redis** | `redis:7` | 6379 | `REDIS_URL`, `REDIS_HOST`, `REDIS_PASSWORD` | volume backup only |
| **libSQL** | `ghcr.io/tursodatabase/libsql-server:v0.24.32` | 8080 | `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN` | volume backup only |

Per engine, the registry also owns: the env recipe, mount path, container
command/args (e.g. Mongo replica-set init, Redis `--requirepass`, libSQL
primary/replica + HTTP/gRPC/admin ports), the detection signals used by the
template bridge, and the password-rotation command.

- **Connectivity.** Internal consumers reach a database by its service name on the
  overlay network; an optional **external port** publishes it to the host (with
  conflict detection) for outside tools.
- **Credential rotation.** `database.changePassword` runs the engine's rotation
  command in the running container and atomically updates the encrypted config
  (Postgres/MySQL/MariaDB/Mongo). Connected services pick up the new value on their
  next deploy via the connection-variable refresh.

---

## 10. Backups, destinations & restore

- **Destinations.** S3-compatible backup targets (AWS S3, DigitalOcean Spaces,
  MinIO, Backblaze B2, Wasabi, any S3 endpoint). Stored encrypted with a
  **test-connection** check. Credentials are passed to rclone via environment
  variables, never on the command line. Router `destination.ts`, schema
  `destination.ts`.
- **Database backups.** Cron-scheduled logical dumps (engine command from the
  registry → gzip → rclone to a destination) with retention (`keepLatestCount`) and
  success/failure notifications. Router `backup.ts`, runner
  `server/core/utils/backups/`, schema `backups.ts`. Each run is recorded as a
  deployment for log visibility; manual "backup now" is supported.
- **Volume backups.** Tar a Docker volume (optionally stopping the service first
  for consistency) → upload to a destination, with retention. Covers Redis, libSQL,
  and any stateful application data. Router `volume-backups.ts`, runner
  `server/core/utils/volume-backups/`, schema `volume-backups.ts`.
- **Restore — with a pre-restore snapshot.** Before a destructive restore, Docklands
  takes a **best-effort snapshot** of the current data (dump or tar) into
  `pre-restore-snapshots/`, then downloads the backup and replays it
  (`pg_restore --clean`, `mysql`/`mariadb` replay, `mongorestore --drop`, or untar
  for libSQL/volumes). Progress streams to the UI via a tRPC subscription
  (`restoreBackupWithLogs`); a non-streaming `backup.restoreBackup` mutation
  exposes the same operation over REST so API/CLI operators can restore too (it
  awaits completion and returns the collected logs). Logic in
  `server/core/utils/restore/`.
- **Scheduling engine.** Cron expressions are registered with `node-schedule` at
  startup (and on enable/disable); jobs run where the service runs — locally via
  `execAsync` or on a remote worker via `execAsyncRemote`.

---

## 11. Deployments, queue & rollbacks

- **Deployment lifecycle.** Each deploy creates a `deployment` row
  (`status: running → done|error|cancelled`) with a log path. History is retained
  (older deployments pruned beyond a per-service limit); logs stream live (see
  [§16](#16-live-logs-terminals--metrics)). Routers `deployment.ts`; services in
  `server/core/services/`. A build can run on a separate **build** worker from the
  **run** worker (`buildRuntimeWorkerId` vs `runtimeWorkerId`).
- **In-memory queue.** `server/queues/` is a process-global singleton: jobs are
  **partitioned per runtime worker**, **serialized per service** (no two deploys of
  the same service run at once), and concurrency is resolved **lazily** so changing
  a worker's `buildsConcurrency` takes effect without a restart. No Redis/BullMQ.
- **Rollbacks.** On a successful deploy, Docklands captures the image tag plus the
  full application context (mounts, ports, env, registry) into a `rollback` row.
  Rolling back re-deploys the stored image without rebuilding; a stored rollback
  can also be **deleted** from the deployments view (which removes its captured
  Docker image to reclaim disk). Router `rollback.ts`, schema `rollbacks.ts`.

---

## 12. Preview environments

- **What.** Per-pull-request ephemeral deployments of an application, each isolated
  under a generated app name and optionally given its own domain. Status is tracked
  independently and reported back as a status comment on the PR. **GitHub only** —
  the feature is built on the GitHub App (PR webhooks + Octokit PR comments), so the
  Previews tab is shown only for GitHub-sourced services.
- **Lifecycle & limits.** Previews are created/redeployed on PR open/synchronize and
  torn down on PR close. `previewLimit` caps concurrent previews per app — at the cap
  the **oldest preview is evicted** to make room for a new PR (re-deploys of an
  existing PR never count against the cap). `previewExpirationDays` (per app, `0` =
  disabled) sets an inactivity TTL: `expiresAt` is refreshed on every deploy and an
  hourly cron reaps previews past it, so abandoned PRs don't linger.
- **How.** Schema `preview-deployments.ts`, router `preview-deployment.ts`, service
  in `server/core/services/preview-deployment.ts`; the expiry reaper in
  `server/core/utils/previews/` (wired into startup as `initPreviewCleanupCron`).
  Application fields `isPreviewDeploymentsActive`, `previewPort/Https/Path`,
  `previewWildcard`, `previewLimit`, `previewExpirationDays`, and
  `previewRequireCollaboratorPermissions` configure behavior; GitHub PR webhooks
  (`server/web/deploy/github-webhook.ts`) drive creation. Preview domains skip
  inherited redirect middlewares.

---

## 13. Ingress: domains, TLS, redirects, ports & basic-auth

Traefik is configured purely by **generating YAML on disk** (per-app router/service
files plus a shared middlewares file); there are no Traefik API calls. Generators
live in `server/core/utils/traefik/`. The proxy files are browsable/editable under
`/dashboard/proxy-files`.

- **Domains.** Attach a custom domain (host + path + target port) to an application,
  compose service, or preview. Options: HTTPS on/off, path strip / internal-path
  rewrite, custom entrypoint, and certificate type. IDN hosts are punycode-encoded.
  A DNS validator checks resolution (and warns on CDNs). Router `domain.ts`, schema
  `domain.ts`, generator `traefik/domain.ts`. When HTTPS is on, an HTTP router
  redirects to the HTTPS router, which carries the TLS resolver + middlewares.
- **TLS / certificates.** Three modes per domain: **none**, **Let's Encrypt** (ACME
  via Traefik's `letsencrypt` resolver — requires a real contact email in ingress
  settings), or **custom** (upload PEM cert + key, stored encrypted, written to the
  Traefik cert path; supports wildcards). Router `certificate.ts` (note the tRPC key
  is `certificates`), schema `certificate.ts`.
- **Redirects.** Per-app regex redirects (301/302) become Traefik
  `redirectRegex` middlewares chained onto the domain routers. Router `redirects.ts`,
  schema `redirects.ts`, generator `traefik/redirect.ts`.
- **Ports.** Publish container ports on the host through Swarm, in `host` mode
  (single node) or `ingress` mode (load-balanced across nodes), TCP or UDP. Router
  `port.ts`, schema `port.ts`.
- **Basic-auth security.** Add HTTP basic-auth (username + password) to a service;
  the password is bcrypt-hashed into a Traefik `basicAuth` middleware (with the
  `Authorization` header stripped before forwarding). Router `security.ts`, schema
  `security.ts`, generator `traefik/security.ts`.

**End to end:** create a domain → the domain/redirect/security generators write/merge
`{appName}.yml` and `middlewares.yml` → Traefik picks up the files, obtains the
certificate (for Let's Encrypt), and routes `Host(...)`/`PathPrefix(...)` traffic to
the Swarm service, applying auth/redirect/path middlewares in order.

---

## 14. Runtime workers & the Swarm cluster

- **Runtime workers (local + remote).** A worker is a machine that builds and/or
  runs services. Workers are typed **deploy** or **build**, each with its own
  `buildsConcurrency` and optional Docker-cleanup schedule. The local control plane
  is the default worker; remote workers are reached over SSH using a stored SSH key.
  - **Provision / validate / audit.** `server/core/setup/runtime-worker-setup.ts`
    SSHes in and installs Docker, the builders (Nixpacks/buildpacks/Railpack), and —
    for deploy workers — initializes Swarm, the `docklands-network` overlay, and
    Traefik. `runtime-worker-validate.ts` checks versions/network/privileges;
    `runtime-worker-audit.ts` reports the host's security posture (UFW, SSH config,
    fail2ban, unattended-upgrades). Router `runtime-worker.ts` (incl. streaming
    setup logs), schema `runtime-worker.ts`.
  - **Remote Workers Only.** An owner/admin toggle on the Runtime Workers page
    (`remoteServersOnly`) enforces that every service must run on a remote worker,
    blocking deploys to the local control-plane host runtime.
- **Swarm cluster.** Initialize Swarm (auto-detecting the advertise address),
  create the overlay network, and manage nodes: list nodes, get join commands for
  workers/managers, and drain+remove a node (guarded so you can't break manager
  quorum). Routers `cluster.ts` and `swarm.ts`; surfaced at
  `/dashboard/cluster-runtime`.
- **Local vs remote execution model.** Local Docker uses `dockerode` against the
  socket; remote work uses `execAsyncRemote` / a Dockerode SSH client. Process
  helpers in `server/core/utils/process/` redact secrets (PEM keys, base64 tokens)
  from all logs and errors.

---

## 15. Container runtime & Docker control

- **What.** Inspect and control containers directly: list/inspect, start, stop,
  restart, kill, and upload a file into a container — for both local and remote
  workers. Surfaced at `/dashboard/container-runtime`.
- **How.** Router `docker.ts` (gated on `docker:read` / action permissions; every
  container id is validated against `^[a-zA-Z0-9.\-_]+$`), service
  `server/core/services/docker.ts`, Docker client selection in
  `server/core/utils/servers/remote-docker.ts` (local socket or Dockerode-over-SSH).

---

## 16. Live logs, terminals & metrics

WebSocket servers in `server/wss/` are attached to the custom Next server. Each is
an authz + command-injection boundary: container ids, tail counts, `since` values,
search strings, and shells are validated against allowlists; remote paths are
base64-passed to avoid shell expansion.

| Surface | File | Auth gate |
| --- | --- | --- |
| Deployment build logs | `wss/listen-deployment.ts` | `docker:read` + read access to the owning service |
| Container logs (follow/tail/since/grep) | `wss/docker-container-logs.ts` | `docker:read` |
| Container terminal (interactive PTY) | `wss/docker-container-terminal.ts` | `docker:read`; shell allowlist |
| Host / worker terminal | `wss/terminal.ts` | **owner/admin only** (host-level access) |
| Docker / host stats | `wss/docker-stats.ts` | `docker:read` |
| Drawer logs (tRPC subscriptions over WS) | `wss/drawer-logs.ts` | authenticated session |

- **Metrics.** `server/core/monitoring/` aggregates CPU/memory/disk/network/block
  stats (host stats via `node-os-utils`; container stats by polling `docker stats`),
  records them to disk for history, and surfaces them at `/dashboard/host-metrics`.
  Refresh rates, container include/exclude filters, and retention are configured
  per instance and per worker (`metricsConfig`). Host CPU/memory notification
  thresholds are not a v0.1.0 shipped alert path.

---

## 17. Notifications

- **What.** Send event notifications to **12 provider types**:
  `slack · telegram · discord · email (SMTP) · resend · gotify · ntfy · mattermost ·
  pushover · custom (HTTP webhook) · lark · teams`. Each notification subscribes to
  one or more events via boolean flags: app deploy, app build error, database
  backup, volume backup, Docklands restart, Docklands backup, Docker cleanup, and
  server CPU/memory threshold alerts.
- **How.** Router `notification.ts` (per-provider create/update/**test**/remove),
  senders + per-event handlers in `server/core/utils/notifications/`, schema
  `notification.ts` (`notificationType` enum; credentials encrypted). There is no
  public monitoring-alert ingestion endpoint in v0.1.0.

---

## 18. Mounts & volumes

- **What.** Three mount kinds (`mountType`): **volume** (Docker named volume),
  **bind** (host path), and **file** (inline content written to a file and mounted).
  Mounts attach to applications, compose services, or any database engine.
- **How.** Router `mount.ts`, service `server/core/services/mount.ts`, schema
  `mount.ts`. `allNamedByApplicationId` reconciles configured mounts against the
  live Docker mounts.

---

## 19. Image registries

- **What.** Store private registry credentials (Docker Hub or any registry URL) for
  pulling base/app images and pushing build output, with a **test-login** check.
  Applications reference registries for pull, build, and rollback independently.
- **How.** Router `registry.ts`, service `server/core/services/registry.ts`, schema
  `registry.ts` (password encrypted; username case preserved for e.g. AWS ECR).
  Settings at `/dashboard/settings/image-registry`.

---

## 20. SSH keys

- **What.** Generate or import SSH keypairs used for generic-Git clone auth and for
  remote worker connections. Tracks `lastUsedAt`.
- **How.** Router `ssh-key.ts` (tRPC key `sshKey`), service
  `server/core/services/ssh-key.ts`, generation in
  `server/core/utils/filesystem/`, schema `ssh-key.ts` (private key encrypted).
  Settings at `/dashboard/settings/ssh-keys`.

---

## 21. Tags

- **What.** Org-scoped labels (name + color) assigned to workspaces for
  organization/filtering, including bulk assignment.
- **How.** Router `tag.ts`, schema `tag.ts` (+ a workspace↔tag join). Settings at
  `/dashboard/settings/tags`.

---

## 22. Audit log

- **What.** Intended per-organization trail of who did what: actions
  (`create/update/delete/deploy/cancel/redeploy/login/logout/restore/run/start/stop/
  reload/rebuild/move`) across resource types, with actor and resource metadata.
  In the current build this is **not reliable as a shipped audit trail**: schema,
  helper calls, and router shape exist, but persistence and UI readback are not
  complete.
- **How.** Router `audit-log.ts`, service `server/core/services/audit-log.ts`,
  schema `audit-log.ts`. Routers call an `audit(...)` helper inline after
  meaningful mutations; audit writes are best-effort and never break the
  operation.

---

## 23. Patches (file overrides)

- **What.** Override files in an application/compose checkout at deploy time
  (create/update/delete a file), toggled per patch — useful for injecting config or
  small fixes without forking the source.
- **How.** Router `patch.ts` (manage patches, inspect the patch repo, save a file as
  a patch, mark for deletion, GC repos), service `server/core/services/patch.ts`,
  schema `patch.ts`.

---

## 24. Settings surfaces

Under `/dashboard/settings/`, product-named modules configure the instance:

`ingress` · `runtime` · `storage` · `build-workers` · `image-registry` ·
`cluster-nodes` · `roles` · `git-providers` · `ssh-keys` · `certificates` · `tags` ·
`users` · `notifications` · `audit-log` · `profile`.

Instance-wide configuration (server IP/host, HTTPS + Let's Encrypt email, Docker
cleanup, log rotation, build concurrency, monitoring `metricsConfig`) is a
**singleton** row in `web_server_settings`, edited through the `settings` router.

---

## 25. OpenAPI / REST API

- **What.** A REST surface mirroring the tRPC routers, authenticated by **API key**
  (`x-api-key: <key>`). A machine-readable `openapi.json` is generated
  from the routers (no Swagger UI is shipped).
- **Surface parity.** **Every** tRPC procedure is auto-exposed as a REST endpoint
  unless it explicitly opts out (`meta.openapi.enabled: false`), so the API and the
  Web UI stay at feature parity. The surface is curated to a 1:1 mapping: redundant
  or internal procedures are kept off it, while genuine capabilities are reachable
  both ways — e.g. admin request-stats/`swarm.getAppInfos` reads and the
  non-streaming `backup.restoreBackup` are exposed so API/CLI operators have the
  same reach as the UI.
- **How.** Generation in `server/core/openapi/` and `tools/generate-openapi.ts`
  (`bun run generate:openapi`); the request handler is `app/api/[...openapi]/` which
  validates auth headers first. A tRPC call maps to a matching `/api/<router>/<procedure>`
  endpoint unless that procedure opts out of OpenAPI generation.

---

## 26. Ops & admin CLI entrypoints

Bundled to `dist/*.mjs` (esbuild, Node target) from `server/ops/`:

- `migrate-db` — run Drizzle migrations (also runs on production startup before the
  server).
- `setup` + `wait-for-postgres` — first-boot bootstrap (`bun run setup`): waits for
  Postgres, ensures the auth secret and encryption key, initializes the instance.
- `reset-password` — generate a new owner password (printed once, for recovery).
- `restore-instance` — offline whole-instance restore from a Docklands backup
  when the instance uses the bundled `docklands-postgres` service. External
  PostgreSQL installs must use provider/operator database restore tooling plus a
  `/etc/docklands` and `DOCKLANDS_ENCRYPTION_KEY` restore.
- `ensure/migrate auth-secret` — provision or rotate the Better Auth secret.

These never log secrets except where the command exists specifically to reveal one
(e.g. `reset-password`).

---

## Appendix A — tRPC router map

`server/api/root.ts` aggregates 40 routers:

`application · backup · bitbucket · certificates · cluster · compose · database ·
cloudflare · deployment · destination · docker · domain · gitea · gitProvider · github · gitlab ·
mounts · notification · port · previewDeployment · redirects · registry · security ·
settings · sshKey · swarm · user · organization · customRole · serviceDatabase ·
auditLog · rollback · volumeBackups · environment · tag · tunnel · patch ·
workspaceGraph · workspaces · runtimeWorker`.

Routers stay thin: validate input (Zod), check permissions, audit, then call a
service in `server/core/services/`.

## Appendix B — Security boundaries & encryption

- **Encrypted at rest.** Service env / build args / build secrets, database configs,
  registry passwords, SSH private keys, provider tokens, custom certificates +
  keys, basic-auth passwords, and notification credentials use Drizzle
  encrypted-column helpers (`encryptedText`/`encryptedJson`) backed by the instance
  encryption key.
- **Hostile-input boundaries.** `server/web/` (webhooks, OAuth callbacks) validate
  signatures/tokens/state before mutating anything; `server/wss/` validate ids,
  shells, and search/tail/since values against allowlists and gate on permissions
  (host terminal is owner/admin only).
- **Shell safety.** `server/core/utils/{docker,traefik,process,builders,providers,
  backups}` prefer structured args over string-built commands; secrets are passed
  via env, never argv; `process/` redacts secrets from logs and errors.
- **Least privilege.** Every tRPC procedure and WebSocket handler checks permissions
  before side effects; members are additionally constrained to their granted
  resources via `member_resource_access`.

---

*Generated from the `canary` source tree. When a feature's behavior changes, update
the relevant section here in the same change — this file is a description of the
code, not a roadmap.*
