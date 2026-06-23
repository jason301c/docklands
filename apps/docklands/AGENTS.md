# AGENTS.md

`apps/docklands/` is the installable Docklands control plane — a self-hosted
deployment platform (a Dokploy fork) that users run on their own VM. It deploys
apps from Git, Docker images, and Compose; manages Postgres/MySQL/MariaDB/
MongoDB/Redis/libSQL services; routes traffic through Traefik; runs backups;
manages local and remote runtime workers; and exposes deployments, logs, metrics,
and service state.

Read the root `AGENTS.md` first for the workspace, the Bun/Node split, the
toolchain, dev modes, and repo-wide rules. This file owns everything specific to
the app: its architecture, directory layout, product conventions, backend domain,
and security boundaries. Per the root AGENTS.md policy, these are the only two
`AGENTS.md` files — keep this one current whenever the app's structure, stack, or
conventions change.

Keep this package self-contained: the Next.js app, colocated backend, runtime
services, migrations, tests, public assets, templates, and app-specific tooling
all live here. Do not add hosted-SaaS assumptions; the app must work as
customer-owned infrastructure with local Docker, filesystem state, ports,
secrets, domains, and databases.

## Architecture At A Glance

Docklands is a single Node process that serves both the UI and the backend:

- **Custom Next server.** `server/server.ts` boots Next.js (Turbopack, custom
  HTTP server) and attaches the WebSocket servers for logs, terminals, and stats.
  In production (non-cloud) it also bootstraps directories, Traefik config, the
  Swarm overlay network, cron/schedules, and the deployment worker on startup.
- **tRPC contract.** The browser talks to the backend almost exclusively over
  tRPC 11 (`server/api/`), with superjson + React Query on the client. A
  machine-readable OpenAPI surface is generated from the same routers; there is
  no Swagger UI.
- **Drizzle + PostgreSQL.** All persistence is Drizzle ORM over `postgres.js`.
  Schema lives in `server/core/db/schema/`; migrations live in `drizzle/`.
- **Docker Swarm + Traefik.** Deployments run as Swarm services on a
  `docklands-network` overlay; Traefik provides ingress, configured by generating
  YAML files on disk (no direct Traefik API calls). Remote runtime workers are
  reached over SSH (`ssh2`); local Docker is reached via `dockerode`.
- **In-memory deployment queue.** `server/queues/` is a per-runtime-worker FIFO
  queue with per-service serialization, kept as a process-global singleton. There
  is **no Redis / BullMQ** in the control plane (it was removed). Managed Redis is
  just one engine of the unified database table, not a control-plane dependency.
- **Managed databases — one registry-driven engine.** All six managed engines
  (postgres, mysql, mariadb, mongo, redis, libsql) live in a **single `database`
  table** discriminated by an `engine` column, with engine-specific credentials in
  a registry-validated `config` jsonb. The **engine registry**
  (`server/core/databases/registry.ts`) is the single source of truth for each
  engine's detection signals, deploy specifics (image, port, env recipe, mount
  path, container command), connection-variable recipe, backup/restore command,
  and credential rotation — so adding an engine is a registry entry, not new
  schema/router/service/builder/UI. One generic router
  (`api.database`), service (`services/database.ts`), builder
  (`utils/databases/build.ts`), and UI tree (`components/dashboard/database-service/`)
  serve them all; **do not reintroduce per-engine tables/routers/components.**
  Coolify-style **detection** (`databases/detection.ts`) promotes databases found
  inside a compose stack to `service_database` rows (the template bridge). This
  replaced six near-identical per-engine stacks; the upstream Dokploy per-engine
  model is gone.
- **Better Auth + custom RBAC.** Better Auth handles identity, sessions, orgs,
  2FA, and API keys; Docklands layers organization roles, custom roles, and
  per-resource access on top.
- **Self-hosted only — single tenant, one organization per instance.** This is
  software you install on your own VM/Mac, not a hosted multi-tenant PaaS. There
  is no "cloud" mode: the upstream `IS_CLOUD` flag and every cloud-only branch
  were removed. Signup is a single-owner bootstrap (the first registrant becomes
  the owner; everyone else is invite-only), the deployment queue and Swarm/Traefik
  bootstrap always run, and host terminal/stats are always available. There is
  **exactly one organization per instance** — it is created with the first owner
  and cannot be created, switched, or deleted (Better Auth's `/organization/*`
  create/update/delete paths are disabled and there is no org-switcher UI). The
  organization is the instance's identity (its name/logo show in the sidebar; the
  owner edits them via `EditInstance`) and the container for members, roles, and
  invitations — `activeOrganizationId` is therefore effectively constant.
  `member.isDefault` was removed (no "default org" to track). Do not reintroduce
  hosted/multi-tenant code paths or a second organization.

## Directory Map

Path alias: `@/*` resolves to the app root (`tsconfig.json`), so imports look
like `@/server/...`, `@/components/...`, `@/shared/...`, `@/client/...`.

### `app/` — Next.js App Router (UI + route handlers)

- App Router only. Use `page.tsx` / `layout.tsx` / colocated `loading`/`error`
  files; never reintroduce a Pages Router under `pages/`.
- Keep server components focused on data loading, auth boundaries, redirects, and
  composition. Put interactive UI in colocated `_client.tsx` files (or
  `_clients/` for per-variant clients) marked `"use client"`, or in `components/`.
- Browser data access goes through `@/client/api/trpc`; never import server
  services into client components.
- Route groups: `app/(onboarding)/` holds the public auth flows (register,
  invitation, reset-password); `app/dashboard/` is the
  authenticated product, with `app/dashboard/layout.tsx` enforcing the user
  boundary and individual pages gating with permission helpers
  (e.g. `requirePermission(resource, action, fallback)`).
- `app/layout.tsx` sets the Kumo theme and wraps `app/providers.tsx` (tRPC +
  React Query, theme, top-loader, toaster, command search). `app/globals.css` is
  the Tailwind v4 entrypoint: it imports Kumo styles, `@import "tailwindcss";`,
  and `@config "../tailwind.config.ts";`.

#### `app/api/` — route handlers

- Route handlers stay thin: translate the incoming `Request` into a call to
  tRPC, Better Auth, or a `server/web/` helper, and return a standard
  `Response`/`NextResponse`. Do not embed deployment, provider, auth, or Docker
  logic here.
- Handlers run on the Node runtime (`export const runtime = "nodejs"`).
- Notable handlers: `api/trpc/[trpc]` (tRPC), `api/auth/[...all]` (Better Auth),
  `api/[...openapi]` (OpenAPI REST surface; validates auth headers first),
  `api/health`, `api/deploy/*` (refresh-token and GitHub deploy webhooks), and
  `api/providers/*` (GitHub/GitLab/Gitea OAuth + webhooks). The heavy lifting for
  these lives in `server/web/`.

### `components/` — React UI

- **Use Cloudflare Kumo for styled UI.** Import from `@cloudflare/kumo` or the
  granular `@cloudflare/kumo/components/*` paths before building app-owned
  compositions. Prefer the installed package docs/types in
  `node_modules/@cloudflare/kumo` and prefer Kumo defaults for tokens/styles.
- **Do not add ShadCN, Radix UI, cmdk, sonner, or a `components/ui/` primitives
  folder.** Reach for Kumo primitives only when no styled Kumo component can
  preserve the capability. App-owned compositions live near their feature or in
  `components/shared/`.
- Use `cn` from `@/shared/utils` (clsx + tailwind-merge) for class merging.
- Keep server actions, database calls, Docker calls, and filesystem work out of
  components; browser data goes through `@/client/api/trpc` and client hooks.
- Settings and deployment controls operate real infrastructure — always show
  clear state, loading, error, and confirmation behavior.
- Layout structure: `components/layouts/` (`side.tsx` Kumo sidebar shell,
  `user-nav.tsx`, `dashboard-layout.tsx`, `onboarding-layout.tsx`,
  impersonation bar). Feature trees live under `components/dashboard/*`.

The **workspace canvas** is the centerpiece: `components/dashboard/workspace/`
(`environment-canvas.tsx`, `workspace-overview.tsx`, plus `actions/` and
`manage/`). Per-service feature trees (`application/`, `compose/`, and the
**single** `database-service/` tree that serves all six managed engines,
`database/backups/`),
runtime surfaces (`container-runtime/`, `cluster-runtime/`, `proxy-files/`,
`deployments/`, `metrics/`), and `settings/*` (including `settings/roles/` for
the custom-role manager) all hang off `components/dashboard/`.

### `client/` — browser-only glue

- Keep Node-only modules, server services, filesystem/Docker/database access out
  of this tree entirely.
- `client/api/trpc.ts` is the browser tRPC entrypoint (`createTRPCReact`, plus
  `RouterInputs`/`RouterOutputs` helpers).
- `client/providers/` holds only React providers/context wiring (tRPC + React
  Query with superjson, `httpBatchLink` for queries, `httpLink` split out for
  FormData uploads, a WS client for log subscriptions; theme provider).
- `client/auth/` configures the Better Auth browser client only
  (organization, two-factor, API-key, admin plugins).
- `client/hooks/` holds reusable browser hooks; if a hook needs backend data it
  calls through the typed tRPC client.

### `shared/` — cross-runtime code

- Importable from both client and server, so keep it cross-runtime: no unguarded
  Node APIs, browser globals, Docker clients, database handles, or process
  mutation.
- Validation schemas used on both sides belong here, especially
  `shared/validation/schema.ts` (which holds the minimal server-side `FileList`
  shim — Node already provides `File`).
- `shared/workspace-graph.ts` defines the workspace canvas types, layout
  constants, and pure graph helpers (node positions, connection orientation,
  topology counts). `shared/utils.ts` holds `cn` and generic helpers;
  `shared/routes.ts` / `shared/dashboard-nav.ts` hold canonical route and nav
  builders.
- If a helper becomes backend-specific, move it to `server/core/`; if it becomes
  browser-specific, move it to `client/`.

### `server/` — colocated backend

- `server/server.ts` — the custom Next server + WebSocket attachment and
  production startup sequence.
- `server/api/` — tRPC. `root.ts` aggregates ~43 routers from `routers/`;
  `trpc.ts` wires context (session, user, db, headers) and the procedure
  factories. **Keep routers thin:** validate input with Zod, check permissions,
  audit meaningful changes, then call a service. Procedure types: `publicProcedure`,
  `protectedProcedure`, `adminProcedure` (owner/admin), and a permission-checked
  procedure factory.
- `server/web/` — non-tRPC HTTP flows used by `app/api/` handlers: deploy
  webhooks, provider webhooks, and OAuth callbacks. **Treat these as
  hostile-input boundaries:** validate refresh tokens, provider signatures,
  callback state, and target resources before mutating deployments or
  credentials, and keep response semantics compatible with external providers
  (small status-code changes can break webhook integrations).
- `server/queues/` — the in-memory deployment queue: per-runtime-worker
  partitions, per-service serialization, a process-global singleton, and
  concurrency resolved lazily so runtime-setting changes take effect without a
  restart.
- `server/wss/` — WebSocket servers for deployment logs, container logs,
  container terminals, host terminal, drawer logs, and Docker stats. These are
  command-injection and authz boundaries: gate Docker sockets on `docker:read`,
  restrict host-terminal access to owner/admin, and validate container ids,
  tail/since values, search strings, and shells against the existing allowlists.
- `server/ops/` — runtime/admin entrypoints bundled into `dist` (DB migration,
  setup, wait-for-postgres, reset-password, reset-2fa, ensure/migrate
  auth-secret). Keep imports server-only and startup-safe; never log secrets,
  tokens, keys, database URLs, or generated passwords unless the command exists
  to reveal them. When adding an entrypoint, update `package.json`,
  `esbuild.config.ts`, and docs together.

### `server/core/` — backend / domain library

The backend domain library. Keep it here unless there is a real architectural
reason to move code out.

- `services/` — domain services (~43), the home for business logic. Keep side
  effects explicit and testable; routers call services, not the other way around.
  `services/permission.ts` is the RBAC core (see below).
- `db/` — Drizzle setup. `db/index.ts` is the connection (dev reuses a global
  singleton). `db/schema/` holds the schema modules (one per table/domain,
  including `member-resource-access.ts`, `workspace.ts`, `workspace-graph.ts`,
  `database.ts` (the **single unified managed-database table** — see "Managed
  databases" below), `service-database.ts`, providers, domains, certs, backups,
  audit-log, etc.). After schema edits run `bun run migration:generate` and
  commit the SQL plus `drizzle/meta` updates. `db/drizzle.config.ts` is the
  Drizzle Kit config.
- `databases/` — the **database engine registry** (`registry.ts`) and detection
  (`detection.ts`): the single source of truth for the six managed engines
  (postgres/mysql/mariadb/mongo/redis/libsql). See "Managed databases" below.
- `lib/` — `auth.ts` (Better Auth setup: Drizzle adapter, organization/admin/
  two-factor/api-key plugins, trusted origins, request validators for Fetch and
  Node WS), `access-control.ts` (the canonical permission `statements`: resources
  × actions, and the static role definitions), `auth-secret.ts`, `logger.ts`.
- `utils/` — security-sensitive infrastructure helpers. Prefer structured
  arguments and existing helper APIs over string-built shell commands.
  Subtrees: `docker/`, `traefik/` (generates ingress YAML), `builders/`
  (Nixpacks, Dockerfile, Heroku/Paketo/Railpack buildpacks, static, compose,
  drop), `providers/` (Git clone for GitHub/GitLab/Gitea/Bitbucket), `databases/`
  (per-engine config), `backups/`, `volume-backups/`, `schedules/`,
  `notifications/`, `process/` (`execAsync` / streaming / `execAsyncRemote` over
  SSH, with secret redaction), `filesystem/`, `cluster/`, `servers/`, `restore/`,
  `access-log/`, `startup/`, `watch-paths/`.
- `setup/` — Swarm init, overlay network, Traefik bootstrap, runtime-worker
  setup/validate/audit, and `config-paths.ts` (environment-aware paths:
  `.docker/` in dev, `/etc/docklands` in production).
- `runtime/` — runtime helpers that back production deploy behavior (deploy
  orchestration, docker ops, cleanup/GC, host/network info).
- `constants/` — `docker.ts` (the dockerode client with socket/host detection),
  paths, cleanup.
- `templates/` — template *logic* (keep template code here, not in a root-level
  `templates/` dir; the app-root `templates/` directory is template *data`).
- `monitoring/`, `emails/`, `openapi/`, `verification/`, `types/` — Docker stats
  aggregation; React Email templates (`render`, not `renderAsync`); OpenAPI
  generation; email/2FA verification; shared backend types.

### `tools/` — app-coupled dev scripts

Scripts that import app internals (e.g. `server/api/root`) or emit app-owned
artifacts. `generate-openapi.ts` writes `openapi.json` for docs/tooling
consumers. Production startup/migration/recovery/setup entrypoints belong in
`server/ops/`; repo-level release scripts belong in `../../tools/`.

### `drizzle/`, `templates/`, `public/`, `__test__/`

- `drizzle/` — generated SQL migrations + `meta` snapshots/journal. Do not
  hand-edit snapshots unless deliberately repairing a generated migration.
- `templates/` (app root) — the compose/service **template library** (data:
  hundreds of compose YAML files + `service-templates*.json`), consumed by the
  "add template" workspace action. `public/templates/svgs/` holds the matching
  service icons. Biome and the linter ignore these data dirs.
- `__test__/` — Vitest coverage for backend behavior, security fixes, templates,
  deployments, WebSockets, permissions, and utilities. Prefer focused tests
  around the behavior a patch changes. Mock network, Docker, filesystem, and
  process execution unless the file is explicitly a real integration test. Keep
  `__test__/deploy/application.real.test.ts` out of the routine suite unless the
  machine is prepared for real deployment work. Update fixtures when schema
  fields change; do not keep dead fields in test objects.

## Product Surface And Naming

The product is **workspace-first**. `/dashboard/workspace` is the primary surface
— a project environment canvas for services, variables, deployments, domains,
previews, topology, and connection mapping.

- Extend the canvas before adding parallel project-management pages:
  `components/dashboard/workspace`, `shared/workspace-graph.ts`,
  `server/api/routers/workspace.ts`, and `server/core/services/workspace.ts`.
- Workspace-graph tables store **layout/connection metadata only**. Service
  lifecycle, deployment, variables, previews, logs, and provider behavior keep
  using the existing domain services and routers unless there is a deliberate
  migration.
- **Environment-variable cascade.** Env vars layer
  **workspace → environment → service** (most-specific wins), resolved in
  `prepareEnvironmentVariables` (`server/core/utils/docker/utils.ts`) and applied
  by every builder. The `workspace.env` and `environment.env` stores are **base
  layers inherited by every service** unless the service sets its own value, not
  just a reference table. The `${{workspace.X}}` / `${{environment.Y}}` syntax
  remains as an escape hatch for renaming/composing a value as it cascades down,
  and `${{X}}` resolves a bare name against the merged set. Generated connection
  variables are persisted into the service env, so they sit at the service layer
  and win over inherited values.
- Do not add legacy dashboard aliases or redirect-only compatibility routes.
  Keep `next.config.mjs` free of legacy redirects.
- Canonical product routes for navigation and new links:
  `/dashboard/workspace`, `/dashboard/deployments`, `/dashboard/container-runtime`,
  `/dashboard/cluster-runtime`, `/dashboard/proxy-files`, `/dashboard/host-metrics`,
  `/dashboard/automations`, and the settings routes
  `/dashboard/settings/{ingress,runtime,storage,build-workers,image-registry,cluster-nodes,roles,git-providers,ssh-keys,certificates,tags,users,notifications,profile}`.
- **Product vocabulary:** prefer workspace, service, runtime, worker, ingress,
  container image, preview environment, and automatic placement. Reserve Docker,
  Traefik, Swarm, "server", and old route names for exact engine identifiers,
  commands, logs, schema/API names, imports, or explanatory docs — not as
  top-level product nouns when a Docklands term exists.
- UI source for settings stays under product-named modules (e.g.
  `settings/ingress-runtime`, `settings/runtime/terminal`, `settings/storage`,
  `settings/image-registry`, `settings/cluster-nodes`, `container-runtime/*`).
  Backend compatibility APIs such as `getWebServerSettings`, `destination`, and
  `registry` may keep their names until dedicated data migrations rename them.

## RBAC, Permissions, And Auth

Authorization has three layers; preserve least privilege, auditability, and
organization scoping in every change.

1. **Identity (Better Auth)** — users, sessions, the single organization,
   members, 2FA, and API keys, via the Drizzle adapter
   (`server/core/lib/auth.ts`). There is one organization per instance (see the
   single-tenant note above), so every member, role, invitation, and
   `organizationId`-scoped resource belongs to that one org. The `organization`
   router (`api.organization`) only reads the active org, edits its name/logo,
   and manages members/invitations — it cannot create, switch, or delete orgs.
2. **Roles** — static roles (`owner`, `admin`, `member`) plus **custom roles**
   stored in the `organization_role` table as JSON permissions, validated against
   the canonical `statements` (resource × action) in
   `server/core/lib/access-control.ts`. The custom-role manager UI lives at
   `app/dashboard/settings/roles` + `components/dashboard/settings/roles/`.
3. **Per-resource access** — member grants are normalized into the
   `member_resource_access` table (`resourceType` ∈ workspace/environment/service/
   gitProvider/runtimeWorker, plus `resourceId`). Legacy per-member access array
   columns were removed; do not reintroduce them. Owners/admins bypass scoping;
   members see only granted resources.

`server/core/services/permission.ts` is the enforcement point
(`checkPermission` / `hasPermission` / `resolvePermissions` and the per-resource
access helpers). tRPC procedures and WebSocket handlers must check permissions
before side effects; routers should audit meaningful mutations to the
`audit-log` table.

## Build, Server, And Runtime

- **Turbopack everywhere.** `server/server.ts` passes `turbopack: true`,
  `build-next` runs `next build --turbopack`, and `next.config.mjs` pins the
  Turbopack root to the Bun workspace root so hoisted deps resolve. Do not add
  Webpack flags, Webpack opt-out env vars, or custom Webpack config. The app
  `build` runs `check:bundler` first; run it directly after bundler/tooling
  changes too.
- **Two build outputs.** `build-server` (`esbuild.config.ts`) bundles the custom
  server and the `server/ops/` entrypoints to ESM `dist/*.mjs` targeting
  `node24`, with `packages: "external"` (native addons stay external) and env
  values inlined via `define` (except `DATABASE_URL`, kept runtime-overridable).
  `build-next` produces the Next build. Production runs
  `dist/migrate-db.mjs` then `dist/server.mjs` on Node.
- **Typegen.** `typecheck` runs `next typegen` (after clearing stale
  `.next/dev/types`) then `tsc --noEmit`. Use it instead of depending on stale
  dev/build route validators. TypeScript is strict (`strict`,
  `noUncheckedIndexedAccess`, `checkJs`); do not weaken it to clear upgrade
  friction.
- The `Dockerfile` builds from the workspace root context so Bun installs the
  workspace consistently. Security headers (X-Frame-Options, CSP frame-ancestors,
  nosniff, referrer policy) are set in `next.config.mjs`; `cpu-features`,
  `node-pty`, and `ssh2` are `serverExternalPackages`.

## Logging

Backend code logs through one structured logger; do not reach for `console.*`.

- **Server (Node): pino.** `server/core/lib/logger.ts` exports `logger` and
  `createLogger(module)`. Give each file its own module logger
  (`const logger = createLogger("docker")`) and log error-object-first:
  `logger.error({ err, appName }, "Failed to pull image")`. The `err`/`error`
  keys are serialized with their cause chain; put IDs/context as sibling fields,
  not interpolated into the message. Output is `pino-pretty` in development and
  JSON in production; level is `LOG_LEVEL` (default `info` in prod, `debug` in
  dev); `LOG_PRETTY=true|false` overrides the format. A `redact` list scrubs
  known secret keys as a backstop — it is **not** a license to log secrets.
- **Browser: `client/lib/logger.ts`.** Client components/hooks use
  `createClientLogger(scope)` (a thin `console` wrapper). `debug`/`info` are
  dev-only; `warn`/`error` always emit. **Never import the Node pino logger into
  client code** — it won't bundle, and the production build will fail.
- **tRPC errors are logged centrally.** `logTRPCError` (exported from
  `server/api/trpc.ts`) is wired into every tRPC adapter (fetch, OpenAPI, WS
  `onError`), so a thrown `TRPCError` is always recorded server-side. When a
  router catches and rethrows, pass `cause` (`new TRPCError({ ..., cause })`) so
  the root error survives — do not add a redundant per-router `logger.error` for
  rethrown TRPCErrors. Fire-and-forget/background work (`.catch(...)`) is *not*
  seen by the sink, so it must log explicitly.
- **Don't silence errors.** No empty `catch {}` and no swallow-and-return without
  a log. Best-effort cleanup may continue past a failure, but log it (usually
  `warn`/`debug`) so it isn't invisible. Demote hot-loop/per-line/per-byte logs
  to `debug`.
- **Secrets never go to logs.** No tokens, passwords, `DATABASE_URL`, private
  keys, or raw env values — not even inside an error message. Redact
  command/stderr strings at the boundary (`utils/process/redactSecrets`,
  `utils/backups/redact`) before logging them.
- **`server/ops/` exception.** CLI scripts that deliberately print a value for a
  human (e.g. `reset-password` revealing a generated password, a setup success
  banner) keep using `console`; route only diagnostics/errors through the logger.
- **`tools/`** are Node dev scripts; `console` is acceptable there, but errors
  must still surface (no empty catches; exit non-zero on failure).

## Security-Sensitive Boundaries

Treat these as test-worthy and review them carefully:

- `server/web/` webhook/OAuth/callback handlers (hostile input).
- `server/wss/` log/terminal/stats sockets (authz + command injection).
- `server/core/utils/{docker,traefik,process,builders,providers,backups}` —
  anything that shells out, drives Docker/Swarm, or writes Traefik/SSH config.
  Prefer structured args and existing helper APIs over string-built commands.
- Auth, permissions, secrets, and `server/ops/` entrypoints (no secret logging).

## Commands

Run from the repo root (`bun run <script>`) or from this directory with the
app-local scripts. App-local highlights:

```sh
bun run dev                 # tsx server/server.ts on Node (custom Next server)
bun run build               # check:bundler + build-server (esbuild) + build-next (Turbopack)
bun run typecheck           # typegen + tsc --noEmit
bun run test                # Vitest (watch)
bun run test:ci             # Vitest run, excludes the real deploy test
bun run migration:generate  # Drizzle: generate SQL from schema changes
bun run migration:run       # apply migrations (tsx server/ops/migrate-db.ts)
bun run generate:openapi    # regenerate openapi.json from the tRPC routers
bun run format-and-lint:fix # Biome format + lint (autofix)
```

Do not start the dev server for unattended verification unless asked; use
typecheck, Vitest, build, and static inspection.
