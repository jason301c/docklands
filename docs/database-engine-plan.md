# Docklands Database Engine & Template Bridge Plan

Status: design + actionable plan (not yet started). Authored while deciding how to
unify the two service-creation paths — first-class databases vs. the vendored
Coolify template catalog — into one coherent engine.

**Premise (locked):** Docklands is **pre-release**. There are no users, no
instances to upgrade, no stable API to protect (see "Project Status — Pre-Release,
No Compatibility Debt" in the root `AGENTS.md`). So this plan targets the
**cleanest end-state**, not a backward-compatible migration path. We drop and
replace tables wholesale; we do not write backfill/bridge migrations to preserve
data that does not exist.

The request was "copy how Coolify manages their engine." We do — and because we
are greenfield, we realize Coolify's engine *pattern* more cleanly than Coolify
itself does.

---

## TL;DR

Build **one registry-driven database engine** with a **detection bridge** to
templates:

1. **`databaseEngines` registry** — one descriptor per engine (postgres, mysql,
   mariadb, mongo, redis, libsql; trivially extensible to clickhouse, valkey,
   etc.). Single source of truth for detection, deploy specifics, connection
   strings, and backups.
2. **Collapse the six managed-DB tables into one `database` table**, driven by
   the registry. One generic router + service + builder + management UI replaces
   ~7,500 lines of per-engine duplication. *(This is where we improve on Coolify,
   which keeps eight separate `Standalone*` models.)*
3. **`service_database` bridge entity** — a database **detected inside a compose
   stack** (Coolify's `ServiceDatabase`), created automatically when a template
   is instantiated. Lifecycle-bound to its compose, but a first-class citizen for
   backups and connection variables.
4. **Detection** (`isDatabaseImage()` + contextual disambiguation) wired into the
   existing compose parser — finishing the `isDatabaseImage()` that
   `templates/test-database-detection.yaml` already references but was never
   built.
5. **Generalize capabilities** — backups (`pg_dump`/`mysqldump`/…) and canvas
   connection variables work uniformly over both `database` and
   `service_database`.
6. **Legible product boundary** — *managed services* (databases/caches) vs. *app
   templates* (multi-service apps). Bare single-DB templates route to the managed
   path; multi-service templates keep their embedded DBs, now auto-promoted.

Net effect: a Postgres is a Postgres — whether you add it from the Database
picker or it ships inside `directus-with-postgresql.yaml`. Same backups, same
connection wiring, same credentials. And adding a new engine is a registry entry,
not four new files.

---

## What we copy from Coolify (and where we improve)

Reading `coolify-4.x/` (zip at repo root):

| Coolify mechanism | Where | We copy it as | Improvement |
| --- | --- | --- | --- |
| `DATABASE_DOCKER_IMAGES` (flat image allow-list) | `bootstrap/helpers/constants.php` | `imagePatterns` inside the engine registry | Co-located with the rest of each engine's knowledge instead of a loose const |
| `isDatabaseImage()` + `isDatabaseImageWithContext()` (image match → port/env/healthcheck disambiguation, minus a known-app allow-list) | `bootstrap/helpers/docker.php` | `server/core/databases/detection.ts`, registry-backed | Same two-stage logic; data comes from the registry |
| `ServiceDatabase` (DB detected inside a compose `Service`) | `app/Models/ServiceDatabase.php` | `service_database` table + entity | Same concept |
| Normalized `databaseType()` string | `ServiceDatabase::databaseType()` | `engineKey` enum from the registry | A real enum, not a derived string |
| Polymorphic `ScheduledDatabaseBackup` (`morphTo` standalone **or** service DB) | `app/Models/ScheduledDatabaseBackup.php`, `app/Jobs/DatabaseBackupJob.php` | `backups` linked to `database` **or** `service_database`; dump command from `engine.backup` | We avoid morph soup; one collapsed `database` table + one bridge table |
| Per-engine `Standalone*` models (8 of them, ~3,224 LoC) | `app/Models/Standalone*.php` | **Not copied.** Collapsed into one `database` table + registry | This is the duplication Coolify never solved |

**The thesis:** Coolify's *engine* is the detection bridge + normalized type +
polymorphic capability sharing. That is good and we copy it. Coolify's *data
model* (eight near-identical models) is legacy we don't have to inherit — being
greenfield, we drive everything from one registry instead.

---

## Where Docklands stands today

- **Six first-class DBs** ≈ Coolify's `Standalone*`: `postgres`, `mysql`,
  `mariadb`, `mongo`, `redis`, `libsql`, each with its own
  schema/router/service/builder (`server/core/db/schema/*.ts`,
  `server/api/routers/*.ts`, `server/core/services/*.ts`,
  `server/core/utils/databases/*.ts`). ~7,500 LoC of duplication.
- **Compose stacks** ≈ Coolify's `Service`: `compose.ts` + `processComposeTemplate`.
- **Connection-variable wiring** already exists for the six typed engines in
  `server/core/services/workspace-graph.ts`.
- **A partial, ad-hoc bridge already exists:** `backups.ts` has
  `backupType: "database" | "compose"`, a `serviceName` column, and a `metadata`
  jsonb "only for compose backups." So compose-embedded DB backups sort of work
  today — but there is no modeled entity, no detection, no connection-var
  emission. `service_database` formalizes this.
- **`backups` is already FK-per-type** (`postgresId`, `mysqlId`, … `composeId`) —
  trivially restructured.
- **Orphaned intent:** `templates/test-database-detection.yaml` documents an
  `isDatabaseImage()` that does not exist. This plan builds it.

**The gap:** a directly-added Postgres is first-class; the same Postgres bundled
in a template is an opaque container. Closing that is the UX win.

---

## Target architecture

### 1. The engine registry — `server/core/databases/registry.ts`

One descriptor per engine, the single source of truth that powers creation,
detection, connection variables, and backups:

```ts
interface DatabaseEngine {
  key: "postgres" | "mysql" | "mariadb" | "mongo" | "redis" | "libsql";
  label: string;
  icon: string;
  tags: string[];

  // --- detection (Coolify DATABASE_DOCKER_IMAGES + context) ---
  imagePatterns: string[];   // ["postgres", "postgis/postgis", "pgvector/pgvector", "supabase/postgres", "timescaledb"]
  defaultPorts: number[];    // [5432]
  detectEnvKeys: string[];   // ["POSTGRES_PASSWORD"]
  detectHealthcheck: string[]; // ["pg_isready"]
  knownAppDenylist?: string[]; // ["postgrest/postgrest", "supabase/postgres-meta", ...]

  // --- deploy specifics ---
  defaultImage: string;            // "postgres:18"
  containerPort: number;           // 5432 (target port inside container)
  mountPath: (image: string) => string;  // version-aware: PG18+ -> /var/lib/postgresql
  buildEnv: (creds: Credentials) => string[];   // POSTGRES_DB/USER/PASSWORD ...
  extraPorts?: (cfg) => PortSpec[]; // libsql: HTTP + gRPC + admin

  // --- credentials (registry-validated jsonb, per engine) ---
  credentialsSchema: z.ZodType;    // postgres: {user,password,db}; redis: {password}; ...

  // --- capabilities ---
  connectionVars: (ctx: ConnCtx) => Record<string, string>;  // DATABASE_URL, POSTGRES_HOST ...
  backup?: {
    dump: (ctx) => string;     // "pg_dump --format=custom ..."
    dumpAll?: (ctx) => string; // "pg_dumpall ..."
    restore: (ctx) => string;
  };
  changePassword?: (ctx) => string;  // psql -c "ALTER USER ..."
}
```

This consolidates what Coolify spreads across `DATABASE_DOCKER_IMAGES`, each
model's `internal_db_url`/`external_db_url` accessors, and `DatabaseBackupJob`'s
per-engine match arms.

### 2. One `database` table (collapses the six)

```
database
  databaseId        pk
  engineKey         enum (from registry)        -- "postgres" | "redis" | ...
  name, appName, image, status
  credentials       jsonb  -- validated by engine.credentialsSchema (user/password/db/...)
  externalPort, replicas
  ...swarm/resource/health config (the columns all six share today)
  environmentId     fk
  runtimeWorkerId   fk
```

- **Generic router** `server/api/routers/database.ts` (replaces the six):
  `create`, `deploy`, `start`, `stop`, `reload`, `remove`, `changeStatus`,
  `changePassword`, `saveExternalPort` — all dispatch through the registry by
  `engineKey`.
- **Generic service** `server/core/services/database.ts`: `createDatabase`,
  `deployDatabase`, … reading deploy specifics from the descriptor.
- **Generic builder** `server/core/utils/databases/build.ts`: one
  `buildDatabase()` assembling the Swarm `CreateServiceOptions` from
  `engine.buildEnv`, `engine.mountPath`, `engine.containerPort`,
  `engine.extraPorts`. Engine-specific quirks (mongo replica-set init script,
  redis `--requirepass`, libsql sqld primary/replica) live as descriptor hooks,
  not separate files.

**Tradeoff (accepted):** engine-specific credential fields move from typed columns
to a registry-validated `credentials` jsonb. We lose SQL-level column typing for
credentials but gain a zero-schema-change path to new engines; validation still
happens at the app boundary via Zod, exactly as the rest of the codebase already
works. The columns the engines genuinely share stay real columns.

### 3. `service_database` — the compose-embedded bridge

```
service_database
  serviceDatabaseId pk
  composeId         fk      -- lifecycle owner
  serviceName       text    -- the key in the compose file
  engineKey         enum    -- detected (or custom override)
  image             text
  customType        enum?   -- manual override when detection is wrong
  status
```

Created automatically when a template/compose is instantiated and detection
fires. It is **not** independently deployable — its lifecycle is the compose's —
but it attaches the two capabilities that matter: backups and connection
variables. Mirrors Coolify's `ServiceDatabase` and its `custom_type` escape
hatch.

### 4. Detection — `server/core/databases/detection.ts`

Port `isDatabaseImage(image, serviceConfig)`:
1. base-image match against the union of registry `imagePatterns`;
2. if matched and compose config is present, disambiguate with the registry's
   `knownAppDenylist` + `defaultPorts` + `detectEnvKeys` + `detectHealthcheck`
   (Coolify's exact heuristic set).

Call site: `processComposeTemplate` in `server/core/templates/processors.ts`,
which already walks every compose service. On a hit, record a `service_database`.
`templates/test-database-detection.yaml` becomes the test corpus.

### 5. Generalize capabilities

- **Backups:** restructure `backups` to link to either `databaseId` **or**
  `serviceDatabaseId` (replacing the five per-engine FK columns
  `postgresId/mysqlId/…`, now that managed DBs are one table). The dump/restore
  command comes from `engine.backup`. This subsumes today's ad-hoc
  `serviceName`+`metadata` compose-backup path.
- **Connection variables:** `workspace-graph.ts` emits the same `DATABASE_URL`-
  style vars for a `service_database` node as for a `database` node, sourced from
  `engine.connectionVars`. A template's bundled Postgres becomes wireable on the
  canvas like any managed DB.

### 6. Product boundary & catalog

- **Managed services:** the `Database` picker creates `database` rows
  (independently deployable, registry-driven).
- **App templates:** the 361 Coolify stacks remain *multi-service apps*. Bare
  single-database templates are routed to the managed path instead of deployed as
  opaque compose. Multi-service templates keep their DBs, auto-promoted to
  `service_database`.
- Tag the catalog so the managed-vs-template split is legible in the UI.

### 7. UI consolidation

- Replace the six duplicated management component trees
  (`components/dashboard/{postgres,mysql,mariadb,mongo,redis,libsql}/`) with one
  registry-driven database management surface; engine differences (icon, default
  port, credential labels, whether backups apply) come from the descriptor.
- The `_clients/*-client.tsx` per-engine tab files collapse to one
  `database-client.tsx`.
- Canvas: a `database` node and a `service_database` node render the same and
  both emit connection variables; a compose node can expose its detected
  embedded databases.

---

## End-to-end build plan (clean cutover, no compat shims)

Because we carry no data, each phase replaces rather than bridges.

**Phase 1 — Registry.** Author `databaseEngines` with all six current engines.
Encode every per-engine fact currently hard-coded in the builders/services
(default image, ports, env recipe, mount path, connection-string recipe, backup
command, change-password command). Unit-test each descriptor against the current
behavior so we know the registry is faithful before anything depends on it.

**Phase 2 — Collapse managed DBs onto one `database` table.** New schema +
generic router/service/builder. Delete the six schema files, six routers, six
services, six builders. Rewrite call sites (workspace-graph, backups, search,
move, audit, RBAC `member_resource_access`). Replace the six management UI trees
and the `add-database` picker with the registry-driven generic. One fresh Drizzle
migration drops the old tables and creates `database`; commit the `drizzle/meta`
snapshot. No backfill.

**Phase 3 — Detection + `service_database` bridge.** Add the detection module and
the `service_database` table. Wire detection into `processComposeTemplate`;
promote detected DBs on template instantiation. Add the debug/inspection surface
("this stack contains: 1 postgres, 1 redis").

**Phase 4 — Generalize backups + connection variables.** Restructure `backups`
to `databaseId | serviceDatabaseId`; route dump/restore through the registry.
Extend `workspace-graph` connection-var emission to `service_database`. Retire
the ad-hoc `serviceName`+`metadata` compose-backup path.

**Phase 5 — Boundary, catalog curation, UI polish.** Route bare-DB templates to
the managed path; label the catalog; finish canvas rendering for embedded DBs.

Each phase ends green: `bun run typecheck && bun run test:ci && bun run build`.
Security-sensitive surfaces (credentials in jsonb, backup command construction,
detection false-positives) get tests.

---

## File-level change map

**New**
- `server/core/databases/registry.ts` — engine descriptors.
- `server/core/databases/detection.ts` — `isDatabaseImage` + context.
- `server/core/db/schema/database.ts` — unified managed DB table.
- `server/core/db/schema/service-database.ts` — compose-embedded bridge.
- `server/api/routers/database.ts` — generic router.
- `server/core/services/database.ts`, `server/core/utils/databases/build.ts` — generic service + builder.
- `components/dashboard/database/**`, `_clients/database-client.tsx` — generic UI.

**Rewritten**
- `server/core/templates/processors.ts` — detection hook.
- `server/core/services/workspace-graph.ts` — connection vars over `database` + `service_database`.
- `server/core/db/schema/backups.ts` + backup job/utils — `databaseId | serviceDatabaseId`, registry-driven dump.
- `components/dashboard/workspace/actions/add-database.tsx` — registry-driven picker.
- RBAC/search/move/audit call sites referencing the old per-type ids.

**Deleted**
- `server/core/db/schema/{postgres,mysql,mariadb,mongo,redis,libsql}.ts`
- `server/api/routers/{postgres,mysql,mariadb,mongo,redis,libsql}.ts`
- `server/core/services/{postgres,mysql,mariadb,mongo,redis,libsql}.ts`
- `server/core/utils/databases/{postgres,mysql,mariadb,mongo,redis,libsql}.ts`
- `components/dashboard/{postgres,mysql,mariadb,mongo,redis,libsql}/**`
- the six `_clients/{engine}-client.tsx`

**AGENTS.md upkeep:** `apps/docklands/AGENTS.md` must be updated in the same change
to describe the database engine registry + the managed/`service_database` split,
replacing any per-engine description.

---

## Risks & things to get exactly right

- **libSQL** is the awkward engine: multiple ports (HTTP/gRPC/admin) and
  primary/replica `sqld` topology. The descriptor's `extraPorts` + a config slice
  in `credentials`/jsonb must express it; verify before deleting `libsql.ts`.
- **Mongo replica sets** and **Redis `--requirepass`** are deploy-time quirks —
  keep them as descriptor hooks, not lost in the collapse.
- **Detection false positives** (an app image that looks like a DB) — port
  Coolify's `knownAppDenylist` and the env/healthcheck context checks; the
  fixture must cover the `postgrest`/`metabase`/`supertokens` cases.
- **RBAC `member_resource_access`** keys resources by id; the table collapse
  changes id provenance (six tables → one). Audit every reader/writer.
- **Credentials in jsonb** — ensure the existing encryption/secret-handling for
  DB passwords is preserved when they move off typed columns.

---

## Implementation status

- **Phase 1 — DONE.** Engine registry (`server/core/databases/registry.ts`) + detection (`detection.ts`), 36 tests. Fixed latent `redis-server`/`libsql-server` image bugs.
- **Phase 2 (collapse) — DONE.** One `database` table + generic service/router/builder replace the six per-engine schemas/routers/services/builders; the six per-engine UI trees collapse to `components/dashboard/database-service/` + one route client. All consumers (workspace-graph, environment, workspace, mount, backups/restore, volume-backups, runtime-worker, canvas) read the unified table. Migrations 0003 (add) + 0005 (drop the six tables + FK columns). Net ≈ −6.2k lines.
- **Phase 3 (bridge) — DONE.** `service_database` table + registry-backed detection wired into `processComposeTemplate`; template instantiation auto-promotes detected databases. `test-database-detection.yaml` drives a real test.
- **Phase 4 (generalize) — DONE.** Backups/restore are registry-driven over the unified `database`. `service_database` (compose-embedded DBs) is now a first-class backup + connection-info source: the registry extracts credentials from the compose service env at promotion, `runServiceDatabaseBackup` dumps the container resolved by service name inside the stack, and the compose detail surfaces each embedded database with connection variables + a backups panel. Migration 0006.
- **Phase 5 (boundary/catalog) — DONE.** `analyzeTemplateDatabases` labels each catalog template with its detected engines; bare single-database templates are routed to the managed-database picker (preset to the engine) instead of an opaque compose deploy.

All five phases are complete and green (typecheck 0, full Vitest suite, build).

## Locked decisions

All four confirmed during review — the plan above is build-ready.

1. **Table collapse — YES.** Collapse the six managed-DB tables into one
   registry-driven `database` table with one generic router/service/builder/UI.
   This is the deliberate improvement over Coolify and the point of being
   greenfield.
2. **Promotion — auto-detect, opt-out.** On template/compose instantiation,
   auto-create `service_database` rows for detected databases, surfaced
   non-destructively, with a per-DB opt-out via `customType`/ignore.
3. **Credentials — registry-validated jsonb.** Engine-specific credential fields
   live in a `credentials` jsonb column validated per-engine by the registry's
   Zod schema; zero schema change to add a new engine. Shared fields stay real
   columns. Preserve the existing password encryption when moving off typed
   columns (see Risks).
4. **Scope ceiling — databases + bridge only.** Applications and compose keep
   their own models (as in Coolify). Unifying them into a shared service model is
   explicitly out of scope and would require its own plan.
