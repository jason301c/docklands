# Docklands Architecture Review & Feature→Impl Map

> Internal engineering companion to the user-facing docs in `apps/docs`.
> Written while documenting every feature end-to-end. This file is **not
> published** — it records the feature→implementation mapping plus every
> architectural hiccup, half-finished path, sharp edge, and notable decision
> discovered along the way.
>
> Generated during the documentation pass on 2026-06-23. Branch:
> `chore/kumo-migration-cleanup`.

## How to read this

Each domain section has two parts:

- **Feature → impl** — what the feature is, and the concrete routers / services
  / schema / UI that implement it (so the next engineer can navigate fast).
- **Notes** — findings, tagged:
  - 🐞 **bug / likely-broken** — looks incorrect or will fail at runtime.
  - 🚧 **half-finished** — stubbed, TODO, or wired only partway.
  - 🧨 **footgun / sharp edge** — works, but easy to misuse or surprising.
  - 🏗️ **design smell** — works, but the shape will not scale / fights itself.
  - 🔒 **security-relevant** — auth, secrets, runtime execution, isolation.
  - 📝 **notable** — deliberate decision worth recording (not a problem).

Severity is a judgement call; when unsure it is flagged lower and described.

---

## Executive summary

The product surface is broad and mostly coherent. The issues cluster into a few
themes that cut across domains — fixing the theme is worth more than fixing any
single instance.

### Cross-cutting themes

1. **Secrets are stored unencrypted, everywhere.** SSH private keys, all Git
   provider tokens/secrets, registry passwords, notification secrets, S3
   credentials, TLS private keys, and database passwords are plain `text`
   columns / plain files. One schema comment (`ssh-key.ts:42`) even claims the
   opposite of what the code does. There is no app-level encryption-at-rest
   layer. This is the single biggest security debt; treat DB dumps and
   `/etc/docklands` as secret material until it's addressed.

2. **Connection-variable staleness.** Generated connection variables are written
   once as a snapshot. A database password change (`changePassword`, rotation)
   does **not** propagate to consumers, and removing a connection doesn't retract
   the keys. Consumers silently run with stale credentials. Spans Databases +
   Workspace. The cleanest fix is to make connection variables a *binding*
   re-resolved at deploy time rather than an upsert.

3. **Shell commands built by string interpolation on security boundaries.**
   Database change-password/backup commands, SSH clone (`echo "${privateKey}"`),
   remote Traefik config writes (`echo '${yamlStr}'`), source-patch `filePath`
   (`services/patch.ts`), and cluster `nodeId` commands all interpolate values
   into shell strings run locally or over SSH. Several are saved only by a
   validation regex elsewhere; if that regex loosens, they become injection
   vectors. Some (remote YAML write, `nodeId`, patch `filePath`) have no guard at
   all.

4. **The in-memory queue / in-process scheduler lose work on restart.**
   Deployments and scheduled jobs live in process memory (`node-schedule`,
   `myQueue`). A restart drops in-flight/queued deployments and skips any cron
   occurrence that fell while the host was down. No backfill. History (DB) and
   Queue (memory) can disagree after a restart.

5. **Leftovers from the upstream/refactor history.** The "server→runtimeWorker"
   rename leaked into a literal nginx config (a real bug) and many internal
   identifiers (cosmetic); the backup UI still enumerates engines the unified
   registry was meant to own; registry `cloud`/`selfHosted` vestiges, a vestigial
   global `user.role`, and a disabled `admin()` plugin remain.

### Highest-priority concrete items

| Sev | Item | Where |
|---|---|---|
| 🐞 | **Audit log is a complete no-op** — writes/reads stubbed, no UI, yet every router calls `audit(...)` | `services/audit-log.ts:17,34` |
| 🐞 | **GitLab repo/branch listing hits `/api/v4/workspaces`** (a rename leak) → 404s; dropdowns empty after OAuth | `utils/providers/gitlab.ts:226,307` |
| 🐞 | **libSQL DB backup broken end-to-end** — schedulable, always fails; restore path exists with no dump | `backups.ts:79`, `registry.ts` |
| 🐞 | **Static-SPA nginx config emits invalid `runtimeWorker {`** → nginx won't start for SPA static builds | `builders/static.ts:20` |
| 🐞 | **Build-worker concurrency not honored** — deploy queued in the wrong worker's partition | `routers/application.ts:349` |
| 🐞 | **`serverThreshold` alert unreachable** — no UI toggle though schema/sender exist | `handle-notifications.tsx` |
| 🔒 | **Build-log WebSocket has no per-service authz** — guess a `logPath`, stream any build | `wss/listen-deployment.ts:51` |
| 🔒 | **Docker WS streams skip per-service access** — `docker:read` ⇒ any container's logs/terminal in the org | `wss/utils.ts:18` |
| 🔒 | **Request-analytics read only session-gated** — any user reads all ingress access logs (IPs, paths) | `routers/settings.ts:715` |
| 🔒 | **`getServerMetrics` is SSRF-shaped** — server fetches an arbitrary client-supplied URL | `runtime-worker.ts:452` |
| 🧨 | **"Custom" cert provider ≠ uploaded cert** — silently breaks routes; uploaded certs need provider "None" | `utils/traefik/domain.ts:196` |
| 🧨 | **Restore is destructive against the live DB**, no staging/snapshot | `utils/restore/*` |
| 🚧 | **Bare-DB → managed routing is dead in the shipped catalog** (zero single-DB templates) | `analyze.ts`, `add-template.tsx` |

The per-domain sections below have the full lists and the feature→impl maps.

---

## 1. Applications

### Feature → impl

| Feature | Implementation |
|---|---|
| Create / find / update / delete application | `server/api/routers/application.ts` (`create`, `one`, `update`, `delete`); `server/core/services/application.ts` |
| Deploy lifecycle (deploy/redeploy/reload/stop/start) | `application.ts`: `deploy`, `redeploy`, `reload`, `stop`, `start`, `markRunning`, `cancelDeployment`, `killBuild`, `cleanQueues`; queue `server/queues/queueSetup.ts`; `mechanizeDockerContainer` in `server/core/utils/builders/index.ts` |
| Source: Git providers | `saveGithubProvider` / `saveGitlabProvider` / `saveBitbucketProvider` / `saveGiteaProvider`, `disconnectGitProvider`; `sourceType` enum `db/schema/application.ts:56-64` |
| Source: public Git | `saveGitProvider` (`customGitUrl`, `customGitBranch`, `customGitSSHKeyId`) |
| Source: Container Image | `saveDockerProvider`; `getImageName` / `getAuthConfig` in `builders/index.ts` |
| Source: Drop (zip) | `dropDeployment` (zfd formData); `server/core/utils/builders/drop.ts` (`unzipDrop`) |
| Build types | `saveBuildType`; `buildType` pgEnum `application.ts:66-73`; dispatch `builders/index.ts:getBuildCommand`; per-type files `builders/{nixpacks,docker-file,heroku,paketo,railpack,static}.ts` |
| Env vars / build args / secrets | `saveEnvironment`; injection `prepareEnvironmentVariables` `utils/docker/utils.ts:407` (reference syntax L416-466) |
| Ports | `routers/port.ts`; `db/schema/port.ts` (`publishModeType` host/ingress, `protocolType` tcp/udp) |
| Redirects | `routers/redirects.ts`; `db/schema/redirects.ts` |
| Security (basic auth) | `routers/security.ts`; `db/schema/security.ts` (unique on username+applicationId) |
| Volumes / mounts | `routers/mount.ts`; `db/schema/mount.ts` (`mountType` bind/volume/file) |
| Advanced (resources/replicas/command/Swarm) | schema `application.ts` (`replicas`, `cpu*`/`memory*`, `command`/`args`, `*Swarm` json cols); UI `components/dashboard/application/advanced/**` |
| Preview deployments | `routers/preview-deployment.ts`; `db/schema/preview-deployments.ts`; preview cols `application.ts:87-107` |
| Rollbacks | `routers/rollbacks.ts`; `services/rollbacks.ts`; created in `utils/cluster/upload.ts:51-72` (gated on `rollbackRegistry && rollbackActive`) |

### Notes

- 🐞 **Invalid nginx directive in the Static-SPA config** (`server/core/utils/builders/static.ts:20`). The generated `nginx.conf` emits a bare `runtimeWorker {` block where nginx needs `server {` inside `http {` — a "server"→"runtimeWorker" rename leaked into a literal config string. **Static builds with Single Page Application enabled would fail to start nginx.** The same bad token appears in user-facing log strings (`cluster/upload.ts:43,46`, cosmetic). The non-SPA path is unaffected.
- 🔒 **Build secrets exported as plain env in the build shell script** before the BuildKit invocation in `docker-file.ts:~61-63` and `railpack.ts:~84`, *in addition to* the proper `--secret` mechanism. Values can surface in build logs / process listings.
- 🧨 **`publishDirectory` + `isStaticSpa` are independent with no coupling validation.** A publish directory without SPA enabled → broken client-side routing (404s don't fall back to `index.html`); no warning.
- 🧨 **Drop source + build-type mismatch unvalidated** (`application.ts:784`). `sourceType:"drop"` still builds with whatever `buildType` was selected; a Node zip with `buildType:dockerfile` fails late with a generic error.
- 🏗️ **Audit `resourceType` taxonomy is inconsistent** within `application.ts`: `reload` logs `"application"` (`:213`) while `create`/`delete` log `"service"` (`:129`/`:284`).
- 📝 **Rollbacks are silently inert** unless *both* a rollback registry is attached and `rollbackActive` is set (`utils/cluster/upload.ts:51`). `removeRollbackById` only deletes the row inside the `if (rollback?.image)` branch (`services/rollbacks.ts:151-170`) — an image-less rollback row leaks.
- 📝 **`paketo_buildpacks` has no version field** (hard-pinned `paketobuildpacks/builder-jammy-full`), unlike heroku (`herokuVersion`) / railpack (`railpackVersion` default `0.15.4`, a stale-pin candidate).
- 📝 **`disconnectGitProvider` resets `sourceType` to `"github"`** (`application.ts:608`), not a neutral state.
- 📝 **Env reference resolution order**: `${{workspace.X}}` / `${{environment.X}}` resolve before `${{SELF}}` (`utils/docker/utils.ts:455`); a missing ref throws and fails the whole deploy (deliberate fail-fast). Legacy `${{project.X}}` is rejected.

#### Source patches (the `patch` router)

Overlay create/update/delete file edits onto a service's cloned repo at build
time (after clone, before build). `routers/patch.ts`; `services/patch.ts`
(`generateApplyPatchesCommand:136`); schema `db/schema/patch.ts` (`patchType`
create/update/delete, unique on `filePath`+`applicationId`/`composeId`); applied
via `services/application.ts:50`. UI `components/dashboard/application/patches/**`;
working clones cleaned via `cleanPatchRepos` (admin), also surfaced under
Settings → Runtime storage actions.

- 🔒 **Patch apply interpolates `filePath` raw into a shell command.** `generateApplyPatchesCommand` (`services/patch.ts:159-170`) base64-encodes the file *content* (safe) but builds `file="${filePath}"`, `rm -f "${filePath}"`, `mkdir -p "$(dirname "$file")"` with the path double-quoted but unescaped. A patch `filePath` containing `"`, `$(...)`, or backticks would break out of the quoting and execute on the build worker (local or over SSH). The path comes from the repo file browser, gated by `service:create`, but it's still attacker-influenceable input on a shell boundary. Validate/escape `filePath`.
- 📝 **Patches re-apply to a fresh clone every deploy** — an *update* patch silently overwrites whatever upstream now has at that path; a *delete* patch no-ops if the path moved. No conflict detection. Documented as a user caution.
- 🏗️ **Patch audit uses `resourceType:"settings"`** for a per-service resource (`routers/patch.ts` throughout) — another audit-taxonomy inconsistency (and moot while audit logging is a no-op).

---

## 2. Managed Databases

### Feature → impl

| Feature | Implementation |
|---|---|
| Engine registry / 6 engines | `server/core/databases/registry.ts` (`databaseEngines`, `DATABASE_ENGINE_KEYS`); labels `components/dashboard/database-service/general/engine-labels.ts`; picker `components/dashboard/workspace/actions/add-database.tsx` |
| Unified table / config jsonb | `server/core/db/schema/database.ts` (`database` table, `databaseEngine` pgEnum, `config` json) |
| Create | `database.create` (`routers/database.ts`) → `createDatabase` + `createDatabaseMount` (`services/database.ts`) |
| Provision/deploy | `database.deploy` / `deployWithLogs` → `deployDatabase` → `buildDatabase` (`utils/databases/build.ts`) |
| Start/stop/reload/rebuild | `database.start|stop|reload|rebuild` (rebuild deletes volumes then `deployDatabase`) |
| Connection variables | `registry.connectionVars` / `databaseConnectionVars`; applied via `applyWorkspaceConnectionVariables` (`services/workspace-graph.ts`) |
| External port | `database.saveExternalPort` (`checkPortInUse`); libSQL multi-port via `registry.publishedPorts`; UI `show-external-database-credentials.tsx` |
| Backups | `registry.backup.dumpCommand`; `runDatabaseBackup` (`utils/backups/database.ts`); `backup.create|manualBackupDatabase` |
| Change password | `database.changePassword` → `registry.changePassword`, run in container via `getServiceContainerCommand` |
| Detection / template bridge | `server/core/databases/detection.ts`; bare single-DB templates routed via `add-template.tsx` |
| Logs | `database.readLogs` → `getContainerLogs` |

### Notes

- 🔒 **Connection variables embed the DB password in plaintext** into target service env (incl. `DATABASE_URL`). `databaseConnectionVars` returns raw `databasePassword` (`registry.ts:325,542,…`), written via `upsertEnvironmentVariables` (`workspace-graph.ts:359`).
- 🧨 **Password change does not propagate to already-applied connection variables.** `changePassword` (router `:430-440`) updates stored config but nothing re-runs `applyWorkspaceConnectionVariables`; connected services keep the old password until manually reapplied/redeployed.
- 🧨 **External-port collision check is best-effort / TOCTOU-prone.** `checkPortInUse` (router `:192`) only inspects running containers on the worker — misses host processes and races with concurrent deploys; Swarm publish can still fail to bind.
- 🏗️ **`databaseChangePasswordCommand` interpolates raw user/password into a shell string** (`registry.ts:332-547`). The only guard is `DATABASE_PASSWORD_REGEX` (`schema/utils.ts:16`) which blocks `$ ! ' " \ /` and spaces — that's what makes the single-quoted interpolation safe. Same pattern in backup dump commands. Keep the regex and shell-building coupled.
- 🚧 **Backup UI hardcodes a per-engine database list** instead of driving off the registry. `handle-backup.tsx` `DatabaseType` union omits `redis`; its compose `databaseType` Select only offers postgres/mariadb/mysql/mongo (`:50-56,358-364`); `show-backups.tsx` `queryMap`/`mutationMap` enumerate engines (`:42-81`). Leftover of the per-engine model the registry replaced.
- 📝 **Redis/libSQL have no logical backup by design** (`registry.databaseEngineSupportsBackup` false). `notificationDatabaseType` maps redis to a "postgres" label defensively (`backups/database.ts:31-34`).
- 📝 **`config` jsonb validated only at the app boundary** (`z.record(z.string(), z.unknown())` in schema `:134,177`); per-engine validation via `parseDatabaseConfig`. `apiUpdateDatabase` deliberately omits `config` (`schema/database.ts:210`) so creds can't be blind-patched — good guardrail.
- 📝 **MySQL/MariaDB dumps run as root** (`buildDatabaseBackupCommand` `:54-61` passes `databaseRootPassword`, falling back to the regular password) — a backup needs the root password to have been generated at create.

---

## 3. Compose & Templates

### Feature → impl

| Feature | Implementation |
|---|---|
| Compose service CRUD + lifecycle | `routers/compose.ts` (`create`,`deploy`,`redeploy`,`stop`,`start`,`delete`,`cancelDeployment`); `services/compose.ts` (`deployCompose`,`rebuildCompose`,`startCompose`,`stopCompose`,`removeCompose`) |
| Source / compose types | `db/schema/compose.ts:23` `sourceTypeCompose` (git/github/gitlab/bitbucket/gitea/raw); `composeType` docker-compose/stack |
| Randomize / isolated deployment | `compose.ts` `randomizeCompose`,`isolatedDeployment`; `utils/docker/compose.ts`, `utils/docker/collision.ts` |
| Catalog load + metadata | `templates/catalog.ts` (`loadTemplateCatalog`,`loadTemplateDefinition`,`parseTemplateHeaders`, `DOCKLANDS_TEMPLATES_DIR`) |
| Catalog tRPC | `compose.ts` `templates`,`getTags`,`deployTemplate` |
| DB labeling in catalog | `templates/analyze.ts` `analyzeTemplateDatabases` → `databaseEngines[]`,`bareDatabaseEngine` |
| Template processing / magic vars | `templates/processors.ts` `processComposeTemplate`; generators `templates/index.ts` |
| Bare-DB → managed routing (UI) | `add-template.tsx:474-510` (renders `AddDatabase` preset to `bareDatabaseEngine`) |
| Embedded DB detection / extraction | `databases/detection.ts`; `registry.ts` `extractDatabaseCredentials` |
| Promotion to `service_database` | `compose.ts:145-154` `persistProcessedTemplateRecords`; schema `db/schema/service-database.ts` |
| Embedded DB router / backup | `routers/service-database.ts`; `utils/backups/service-database.ts` `runServiceDatabaseBackup` |

### Notes

- 🧨 **Bare-database managed-routing is dead in the shipped catalog.** All 361 files in `templates/compose/` are multi-service; **zero** are single-service DB templates, so `isBareDatabase` is never true and the routing card never appears unless a custom `DOCKLANDS_TEMPLATES_DIR` is supplied (`catalog.ts:8`, `analyze.ts:60`, `add-template.tsx:474`).
- 🔒 **Credentials extracted from compose env and stored/served in plaintext.** `processors.ts:871` → `service_database.config` (`compose.ts:146`); `connectionInfo` returns them to anyone with `service:read` (`service-database.ts:34-46`). By design (mirrors managed DBs) but worth flagging.
- 🐞 **`extractDatabaseCredentials` silently defaults missing creds** → connection info/backups become *wrong but plausible* rather than failing. Postgres falls back to user `postgres`/empty password (`registry.ts:723-726`); MySQL falls back to `root` (`:730`). Non-standard env var names → confident-but-incorrect connection vars, backups fail to auth.
- 🧨 **Backup user/password engine quirk**: `buildServiceDatabaseBackupCommand` (`utils/backups/service-database.ts:33-41`) uses root password for mysql/mariadb but regular `databasePassword` for postgres/mongo; mysql dump hardcodes `-u 'root'` (`registry.ts:380`) while mariadb uses `databaseUser` (`:435`). If extraction defaulted root pw empty, mysql/mariadb backups break.
- 🏗️ **Detection runs twice with different inputs** — `analyze.ts` parses raw YAML (catalog labeling) while `processors.ts` runs after env normalization/magic-var expansion (`analyze.ts:51`, `processors.ts:857`). They can disagree. Two detection call sites.
- 📝 **`stop`/`start` asymmetry for Swarm stacks**: `stopCompose` does `docker stack rm` for `composeType:"stack"` (`compose.ts:555-564`) but `startCompose` only handles `docker-compose` (`:507`) — no start path for a removed stack.
- 📝 **`delete` swallows cleanup errors** in empty `catch(_){}` loop (`compose.ts:334-338`) — a failed `docker stack rm`/volume removal leaves orphans silently.
- 📝 **Catalog header parsing is line-fragile** (`catalog.ts:67-79`): stops at first non-comment/non-blank line; a stray line drops all metadata. `DB_IMAGE_HINTS` pre-filter (`:39`) means a DB whose image lacks a literal hint substring is never analyzed.
- 📝 **libSQL embedded detection is weak** — empty healthcheck signal, relies on image-name match (`registry.ts:562-563`).

---

## 4. Networking (Domains, TLS, Ingress)

### Feature → impl

| Feature | Implementation |
|---|---|
| Domain CRUD | `routers/domain.ts` (`create/update/delete/one/byApplicationId/byComposeId`); `services/domain.ts`; schema `db/schema/domain.ts`; Traefik gen `utils/traefik/domain.ts` (`manageDomain`,`createRouterConfig`,`removeDomain`); UI `application/domains/handle-domain.tsx` |
| Test (`sslip.io`) domain | `domain.generateDomain`, `canGenerateTraefikMeDomains`; `generateTraefikMeDomain` |
| DNS validation | `domain.validateDomain`; `services/cdn.ts` (`detectCDNProvider`); `domains/dns-helper-modal.tsx` |
| Path routing / strip / internal path | `domain.path/internalPath/stripPath`; `utils/traefik/middleware.ts` `createPathMiddlewares` |
| HTTPS / per-domain cert provider | `domain.https/certificateType/customCertResolver`; `createRouterConfig` sets `tls.certResolver` + `redirect-to-https` |
| Custom certificate files | `routers/certificate.ts`; `services/certificate.ts` `createCertificateFiles`; schema `db/schema/certificate.ts`; writes `chain.crt`/`privkey.key`/`certificate.yml` |
| Redirects | `routers/redirects.ts`; `services/redirect.ts`; `utils/traefik/redirect.ts` |
| Control-plane ingress domain + LE email | `settings.assignDomainServer` (`:282`); `web-server-settings.ts`; `utils/traefik/web-server.ts` |
| Ingress reload / public IP / ports | `settings.reloadTraefik`,`updateServerIp`,`getTraefikPorts`/`updateTraefikPorts`; `setup/traefik-setup.ts` `initializeTraefikService` |
| Proxy files browse/edit | `settings.readDirectories`/`readTraefikFile`/`updateTraefikFile` (gated on `traefikFiles` perm); `utils/traefik/application.ts` |
| Traefik bootstrap (static config) | `setup/traefik-setup.ts` (`getDefaultTraefikConfig`,`createDefaultMiddlewares`) |

Traefik config: dynamic per-service files + `middlewares.yml` under `server/core/utils/traefik/`; static `traefik.yml` + `acme.json` from `setup/traefik-setup.ts`. Paths via `constants/paths.ts` → `/etc/docklands/traefik/{,dynamic}` (prod), `.docker/traefik/...` (dev).

### Notes

- 🧨 **"Custom" cert provider ≠ uploaded custom certificate.** A domain with `certificateType:"custom"` emits `tls.certResolver:<customCertResolver>` (`utils/traefik/domain.ts:196`), requiring an ACME resolver that exists in `traefik.yml` — but Docklands only ever defines the `letsencrypt` resolver (`traefik-setup.ts:304-314`). Uploaded cert files are served by SNI via the TLS *file* provider and need provider **None**. Choosing "Custom" with a bogus resolver silently breaks the route at request time.
- 🔒 **Certificate private keys stored in plaintext** (`db/schema/certificate.ts` plain `text`; written as plain files `services/certificate.ts:123-124`). No encryption at rest.
- 🔒/🐞 **Shell interpolation writing cert/config to remote workers.** `writeTraefikConfigRemote` (`utils/traefik/application.ts:281-294`) uses raw `echo '${yamlStr}'`; YAML with a single quote breaks the command or allows injection over SSH. `createCertificateFiles` base64-encodes first (safer).
- 🧨 **Hardcoded placeholder ACME email `test@localhost.com`** (`traefik-setup.ts:307,362`), only replaced when an admin sets the ingress LE email. Enabling LE on a domain without setting the email keeps the bogus address.
- 🧨 **Let's Encrypt resolver only added when `NODE_ENV==="production"`** (`traefik-setup.ts:291-315`); HTTP-01 only (no wildcards). Repeated HTTPS toggling against bad DNS can burn the weekly issuance limit.
- 🧨 **Editing proxy files / `traefik.yml` is unguarded and can take down all ingress** (`settings.updateTraefikFile:533`, "Skip YAML validation" offered). Edits to generated per-service files are clobbered on next redeploy.
- 🏗️ **Port schema default contradiction** (`db/schema/port.ts`): column default `publishMode:"host"` vs `createInsertSchema` `.default("ingress")`. Masked by `apiCreatePort` requiring the field.
- 📝 **Domain validation gap for CDN-fronted hosts** — `validateDomain` returns `isValid:true` whenever a CDN IP is detected regardless of origin (`services/domain.ts:174-181`).
- 📝 **Redirects are application-only** (FK `applicationId`, no compose/preview) and skipped for `domainType:"preview"` (`utils/traefik/domain.ts:168`).

---

## 5. Git Providers & SSH

### Feature → impl

| Feature | Implementation |
|---|---|
| Provider CRUD / sharing / access | `routers/git-provider.ts` (`getAll`,`toggleShare`,`remove`); `services/git-provider.ts` (`getAccessibleGitProviderIds`,`canEditDeployGitSource`); schema `db/schema/git-provider.ts` |
| GitHub connect (App manifest) | UI `settings/git/github/add-github-provider.tsx` → `server/web/providers/github-setup.ts` → `app/api/providers/github/setup/route.ts`; auth/clone `utils/providers/github.ts`; router `routers/github.ts` |
| GitHub deploy webhook (signed) | `server/web/deploy/github-webhook.ts` → `app/api/deploy/github/route.ts`; verified via `@octokit/webhooks` `webhooks.verify(...)` against `githubWebhookSecret` (`github-webhook.ts:51-65`) |
| PR preview gate | `checkUserRepositoryPermissions` (`utils/providers/github.ts`); consumed `github-webhook.ts:369-432` |
| GitLab | `routers/gitlab.ts`; `utils/providers/gitlab.ts`; callback `server/web/providers/gitlab-callback.ts`; no webhook handler (uses refresh-token webhook) |
| Gitea | `routers/gitea.ts`; `utils/providers/gitea.ts`; authorize+callback `server/web/providers/gitea-*.ts` |
| Bitbucket | `routers/bitbucket.ts`; `utils/providers/bitbucket.ts` (email:token Basic); no OAuth route, no webhook |
| Per-service refresh-token webhook | `server/web/deploy/application-webhook.ts` + `compose-webhook.ts` → `app/api/deploy/[refreshToken]/route.ts`; auth = secret token in URL + branch/watch-path match, **no signature** |
| SSH keys | `routers/ssh-key.ts`; `services/ssh-key.ts`; keygen `utils/filesystem/ssh.ts` (ssh2 RSA-4096/ed25519); schema `db/schema/ssh-key.ts` |

### Notes

- 🐞 **GitLab repo/branch listing hits a non-existent API path.** `utils/providers/gitlab.ts:307` and `:226` call `GET /api/v4/workspaces` (and `/workspaces/{id}/repository/branches`) but parse the response as GitLab *projects* (`repo.namespace`, `repo.path_with_namespace` at `:172/:188`). GitLab exposes these under `/api/v4/projects` — a repo-wide "projects→workspaces" rename leaked into a third-party API URL. Against real GitLab these 404; repo/branch dropdowns and Test Connection come back empty after a successful OAuth.
- 🧨 **Refresh-token deploy webhook has no payload signature** — auth is solely the secret `refreshToken` in the URL + a branch match (`application-webhook.ts`/`compose-webhook.ts`). Anyone who learns the URL can trigger a deploy. GitLab/Gitea/Bitbucket all rely on this; only the GitHub App webhook is HMAC-verified.
- 🔒 **SSH private keys stored in plaintext in the DB — and the schema comment claiming otherwise is wrong.** `db/schema/ssh-key.ts:42` says "Private key is not stored in the DB," but `apiCreateSshKey` re-merges `privateKey` (`:54`) and `createSshKey` inserts it (`services/ssh-key.ts:13-29`); the column is `notNull` and used at clone time. No encryption at rest.
- 🔒 **All provider credentials unencrypted at rest** — GitHub App private key + webhook secret + client secret, GitLab/Gitea OAuth tokens + client secrets, Bitbucket API token, all plain `text`. `git-provider.getAll` omits them from responses but they sit in DB + backups in the clear.
- 🧨 **SSH private key interpolated into a shell command via `echo "${privateKey}"`** (`utils/providers/git.ts:50,80`), unquoted (unlike branch/URL args which use `shell-quote`), to a fixed `/tmp/id_rsa` path (concurrent-clone race).
- 🏗️ **Provider parity is uneven** — only GitHub auto-registers a signed webhook + supports PR previews + `tag` triggers; others require the manual refresh-token webhook and have no previews; Bitbucket has no OAuth and no `app/api/providers/bitbucket/*` routes.
- 📝 **`git-provider.getAll` reports `bitbucket.isConfigured:false` unconditionally** (`routers/git-provider.ts:69`).
- 📝 **Provider redirect/callback/webhook URLs derived from `window.location.origin`** at creation time — connecting while on `localhost`/internal IP bakes an unreachable URL into the provider config.

---

## 6. Access Control (Orgs, Members, RBAC, Profile)

### Feature → impl

| Feature | Implementation |
|---|---|
| Org CRUD / setDefault / active | `routers/organization.ts` (inline owner checks); org plugin `lib/auth.ts:314`; `disabledPaths` blocks Better Auth's own org create/update/delete |
| Single-owner bootstrap | `lib/auth.ts:124-201` (`databaseHooks.user.create`) + `services/admin.ts:isAdminPresent` |
| Active org on session | `auth.ts:203-225` (`session.create.before` sets `activeOrganizationId`) |
| Invite (link) | `organization.inviteMember`/`allInvitations`/`removeInvitation` (`withPermission("member","create")`); invite token = invitation id |
| Invite (credentials) | `user.createUserWithCredentials` → `services/user.ts:createOrganizationUserWithCredentials` |
| Change member role / remove member | `organization.updateMemberRole` (`withPermission("member","update")`); `user.remove` → `services/admin.ts:removeUserById` (deletes `user` row) |
| Per-member resource access | `user.assignPermissions` → `permission.ts:syncMemberResourceAccess`; schema `member-resource-access.ts` |
| Built-in roles + statements | `lib/access-control.ts` (`statements`, `ownerRole`/`adminRole`/`memberRole`) |
| Custom roles | `routers/custom-role.ts` (`adminProcedure` mutations); schema `organization_role`; `dynamicAccessControl` max 10 (`auth.ts:321`) |
| Permission enforcement | `services/permission.ts` (`checkServiceAccess`, `checkServicePermissionAndAccess`, `checkEnvironmentAccess`, `loadResourceAccess`); `withPermission` `api/trpc.ts:267`; page gating `server/web/app-auth.ts:requirePermission` |
| 2FA / password / API keys / sessions | `twoFactor()`/`apiKey()` plugins `auth.ts:309-313`; `user.update` (pw change deletes other sessions `:201-259`); `user.createApiKey`; sessions `auth.ts:275-278` (3d expiry, 1d refresh) |

### Notes

- 🔒 **WS streams skip per-service access (still-real "F8").** `server/wss/utils.ts:18` `canAccessDockerWs` only checks org-wide `docker:read`; `docker-container-logs.ts:96` checks `runtimeWorker.organizationId === activeOrganizationId` but never `checkServiceAccess`. **A member with `docker:read` can stream logs/stats/terminal for any container in the org, bypassing `member_resource_access` scoping.** A prior audit claimed this fixed, but only the `docker:read` gate was added, not per-service checks.
- 🔒 **API keys inherit full user identity, no per-key scope** (`auth.ts:357-419`). The key is as powerful as its creator (owner key = full host access via the same OpenAPI/tRPC routers, `app/api/[...openapi]/route.ts`). Left as "moot under single-org" by the RBAC audit (D3/F7).
- 🧨 **"Delete User" is a global account delete.** `user.remove` → `removeUserById` deletes the `user` row, cascading to sessions, API keys, 2FA, creds, and memberships in *all* orgs on the install — not just the active org. UI label gives no scoping warning.
- 🔒 **2FA is opt-in, not enforceable org-wide** — no admin "require 2FA" control; gates login only.
- 🏗️ **Roles page under-gates relative to its mutations.** `settings/roles/page.tsx` gates on `requirePermission("member","read")` but all role mutations are `adminProcedure` — a `member:read` custom role can open the manager UI though mutations fail server-side. UX/altitude mismatch, not escalation.
- 🏗️ **`assignPermissions` ownership check is near-no-op** (`user.ts:349` compares `organization?.ownerId !== ctx.user.ownerId`, and `ctx.user.ownerId` is itself the active org's ownerId via `auth.ts:464`). The real guard is the capability check; the comparison could mislead a future reader.
- 📝 **Custom-role permissions can span multiple `organization_role` rows and are merged** (`permission.ts:50-71`, `custom-role.ts:82-99`); `update` collapses duplicates. One-role-to-many-rows by design.
- 📝 **Owner-role sealing is consistently enforced** across `inviteMember`, `updateMemberRole`, `user.remove`, `createUserWithCredentials`, `custom-role` RESERVED_ROLES — the one role boundary that holds firm.
- 📝 **`user.role` global column is vestigial** (`schema/user.ts:53`); `auth.ts:461` overwrites `session.user.role` with the active-org member role each request. The `admin()` Better Auth plugin is **not loaded server-side** (only client `adminClient()`), so global-admin/impersonation is effectively dead despite `allowImpersonation` fields + an impersonation-bar component existing.

---

## 7. Observability (Deployments, Logs, Metrics, Requests, Audit)

### Feature → impl

| Feature | Implementation |
|---|---|
| Deployment history / queue UI | `app/dashboard/deployments/_client.tsx`; `components/dashboard/deployments/show-deployments-table.tsx`, `show-queue-table.tsx` |
| Deployment API | `routers/deployment.ts` (`allCentralized`, `all`/`allByCompose`/`allByServer`/`allByType`, `queueList`, `killProcess`, `removeDeployment`, `readLogs`) |
| Queue | `server/queues/queueSetup.ts` — in-memory `myQueue` (no Redis/BullMQ) |
| Deployment schema | `db/schema/deployment.ts` (status `running|done|error|cancelled`, `logPath`, `pid`) |
| Build-log streaming | `server/wss/listen-deployment.ts` (`tail -f` local / SSH remote); on-demand `deployment.readLogs` |
| Container/runtime-log streaming | `server/wss/docker-container-logs.ts` (`docker logs --follow`) |
| Metrics collection/storage | `server/core/monitoring/utils.ts` (`recordAdvancedStats`, 288-sample JSON under `MONITORING_PATH`) |
| Metrics recording trigger | `server/wss/docker-stats.ts` (the **only** caller of `recordAdvancedStats`, ~1.3s WS interval) |
| Requests analytics | `settings.haveActivateRequests/toggleRequests/readStatsLogs/readStats/updateLogCleanup`; parsing `utils/access-log/{utils,types}.ts`; cleanup `utils/access-log/handler.ts` |
| Audit log | `api/utils/audit.ts` → `services/audit-log.ts`; router `audit-log.ts`; schema `audit-log.ts` |

### Notes

- 🐞 **Audit log is a complete no-op.** `services/audit-log.ts:17` `createAuditLog` is `=> { return; }` and `:34` `getAuditLogs` returns `{ logs: [], total: 0 }`; `routers/audit-log.ts:19` also hardcodes empty. The `audit_log` table exists and ~every router calls `audit(...)`, but **nothing is ever written or read, and there is no UI**. Dead feature.
- 🔒 **Build-log WebSocket lacks per-service authz.** `listen-deployment.ts:51-54` only checks `user && session` (plus path validation `:46`), never that the caller can access the owning service. Any authenticated org user who knows/guesses a valid `logPath` can stream build output. (`docker-container-logs.ts`/`docker-stats.ts` at least gate on `docker:read`.)
- 🔒 **Request-analytics read is only session-gated.** `settings.readStatsLogs`/`readStats` are `protectedProcedure` (`:715`), not behind `monitoring:read`/admin — any signed-in user can read all ingress access-log data (hosts, paths, client IPs, UAs) for the whole deployment. Activation/cleanup are correctly admin-only.
- 🧨 **Metrics are only collected while someone is watching** — recording happens exclusively inside the `docker-stats.ts` WS interval; no background collector. Stored history is sparse/non-continuous (documents *when people looked*, not real usage). Easy to misread as a time series.
- 🚧 **Remote/"paid" metrics path is half-wired** — `host-metrics/_client.tsx:29-37` comments out the source toggle; the Prometheus path (`user.getContainerMetrics`/`getMetricsToken`, `metrics/paid/**`) is unreachable by default and depends on `enablePaidFeatures` + an external agent. Upstream remnant.
- 🧨 **In-memory queue loses state on restart** — `queueList` reads a process-global queue; restart empties it, queued jobs drop, in-flight deploys aren't resumed. Persisted `deployment` rows survive, so History and Queue can disagree after a restart.
- 🏗️ **Audit `resourceType` inconsistency** in `application.ts` (`"service"` at `:129,284` vs `"application"` elsewhere) — would split a service's events when filtering. (Moot while audit logging is a no-op.)
- 📝 **Request analytics is a rolling 1,000-line window** (`access-log/handler.ts:33` truncates + `kill -USR1 1`), parsed in-memory per query; no archival sink; the file grows unbounded between cleanups.
- 📝 **Host metrics assume Linux** (`monitoring/utils.ts:65-155` via `node-os-utils`, filters `loop`/`ram`/`sr*`/`fd*`) — incomplete/zero on non-Linux dev hosts.

---

## 8. Settings & Integrations (Registries, Notifications, Tags, Server)

### Feature → impl

| Feature | Implementation |
|---|---|
| Image registries | `routers/registry.ts` (`create/update/remove/all/one/testRegistry`); `services/registry.ts` (`docker login`/`logout` via `safeDockerLoginCommand`); schema `db/schema/registry.ts`; per-app roles `application.ts` `registryId`/`buildRegistryId`/`rollbackRegistryId` consumed in `builders/index.ts` |
| Notifications | `routers/notification.ts`; `services/notification.ts`; senders `utils/notifications/utils.ts` (`nodemailer` SMTP, `resend`, `fetch`); schema `db/schema/notification.ts` |
| Tags | `routers/tag.ts` (`create/all/one/update/remove/assignToWorkspace/bulkAssign`); schema `tag` + `workspace_tag` |
| Server settings | `routers/settings.ts`; `db/schema/web-server-settings.ts` + `services/web-server-settings.ts` (Swarm `service update`) |

**Notification providers (12):** Slack, Telegram, Discord, Email/SMTP, Resend, Gotify, ntfy, Mattermost, Pushover, Custom HTTP webhook, Lark, Microsoft Teams.
**Events → trigger sites (all wired):** `appDeploy`→`sendBuildSuccessNotifications` (`services/application.ts:234,337`, `compose.ts:314`); `appBuildError`→`sendBuildErrorNotifications` (`application.ts:268`, `compose.ts:349`); `databaseBackup`→`utils/backups/{database,compose}.ts`; `volumeBackup`→`utils/volume-backups/utils.ts`; `docklandsBackup`→`utils/backups/web-server.ts`; `dockerCleanup`→`routers/settings.ts`,`runtime/backup.ts`; `docklandsRestart`→`server.ts:79`; `serverThreshold`→`routers/notification.ts:542`.

### Notes

- 🐞 **`serverThreshold` event has no UI toggle.** Defined in schema, carried by all mutations + form defaults/submit (`handle-notifications.tsx:52,588`), and the sender fires (`server-threshold.ts:34`) — but **no `FormField name="serverThreshold"` is rendered** (`:1816-1945` render the other 7 only). The CPU/memory threshold alert is unreachable through normal config.
- 🔒 **Registry passwords stored in plaintext** (`db/schema/registry.ts:25` `text`), replayed to `docker login`/pull auth. API withholds it from clients (`findRegistryById` `password:false`) but DB/host access exposes it.
- 🔒 **Notification secrets stored in plaintext** — SMTP passwords, bot tokens, webhook URLs, Resend/Pushover/Gotify/ntfy tokens all plain `text`.
- 🧨 **`sendDocklandsRestartNotifications` is not organization-scoped** (`utils/notifications/docklands-restart.ts:27` queries `where docklandsRestart=true` with no `organizationId` filter; called arg-less from `server.ts:79`). Benign single-tenant, but a latent multi-tenant leak inconsistent with every other (org-filtered) sender.
- 🏗️ **Registry schema carries dead `cloud`/`selfHosted` vestiges** — enum `["selfHosted","cloud"]` but API only accepts/sets `"cloud"`; `apiEnableSelfHostedRegistry` exported but unused; UI hardcodes `registryType:"cloud"`. Upstream cloud/self-hosted leftover.
- 📝 **Registry delete nulls app references** (`onDelete:"set null"` on the three FKs) rather than cascading.
- 📝 **Tags are workspace-only** (only `workspace_tag` exists); no service-level tagging. `bulkAssign` is **replace-semantics** (`tag.ts:413` deletes all then inserts).
- 📝 **Per-app "Security" router is HTTP basic-auth** scoped to `applicationId` (`routers/security.ts`), not an instance security page — no distinct instance-level security settings exist.

---

## 9. Backups & Storage (Destinations, DB/Volume backups, Schedules)

### Feature → impl

| Feature | Implementation |
|---|---|
| Destinations (S3) | `routers/destination.ts` (`create/update/one/all/remove/testConnection` — `rclone ls`); `services/destination.ts`; schema `db/schema/destination.ts`; creds `utils/backups/utils.ts:52` `getS3Credentials` |
| Database backups | `routers/backup.ts`; `services/backup.ts`; schema `db/schema/backups.ts`; managed dump `utils/backups/database.ts`; embedded `utils/backups/service-database.ts`; web-server `utils/backups/web-server.ts`; dump commands in registry `databases/registry.ts:683`; shell wrapper `buildBackupShellCommand` (`utils.ts:191`, `rclone rcat`) |
| Restore | `utils/restore/database.ts` (`pg_restore --clean --if-exists`, `mysql`/`mariadb` replay, `mongorestore --drop`, libSQL tar-extract) |
| Volume backups | `routers/volume-backups.ts`; `services/volume-backups.ts`; builder `utils/volume-backups/backup.ts` (`ubuntu`+`tar`, optional `flock`+scale-to-0); restore `volume-backups/restore.ts` |
| Schedules / automations | `routers/schedule.ts`; `services/schedule.ts`; schema `db/schema/schedule.ts`; exec `utils/schedules/utils.ts`; UI `app/dashboard/automations/_client.tsx` |
| Scheduler | in-process `node-schedule`; (re)registered at startup by `initCronJobs()` (`utils/backups/index.ts:17`, called from `server.ts:75`) |

### Notes

- 🐞 **libSQL database backup is broken end-to-end.** `backups.ts:79` rejects only `redis`, not `libsql`; the UI and `databaseType`/`apiRestoreBackup` enums include libSQL, but the registry has **no `backup.dumpCommand` for libsql**, so `buildDatabaseBackupCommand` throws "does not support logical backups". Yet **restore** for libsql IS implemented (`restore/database.ts:33`). So you can schedule a libSQL backup that always fails, with a restore path that has no dump to feed it. Dead `getLibsqlBackupCommand` in `backups/utils.ts:105` is uncalled.
- 🔒 **S3 credentials stored unencrypted and passed on the command line.** Plain `text` columns; `getS3Credentials` interpolates them into `--s3-access-key-id=...`/`--s3-secret-access-key=...` on every `rclone` call (visible in host process args). Logs are redacted and API responses strip keys, but stored values + live process args are not protected.
- 🧨 **Retention errors are swallowed; backup still reports success** (`keepLatestNBackups` `backups/index.ts:147`, `cleanupOldVolumeBackups` `volume-backups/utils.ts:90`) — stale files accumulate silently while runs show green.
- 🧨 **Retention sorts by filename, not object mtime** (`rclone lsf | sort -r | tail`). Correct only because filenames are ISO-timestamp-prefixed; an out-of-band file matching the glob skews pruning.
- 🧨 **Restore is destructive, applied to the live database, no staging/pre-restore snapshot** (`pg_restore --clean`, `mysql` replay, `mongorestore --drop`). Volume restore at least guards in-use volumes (`volume-backups/restore.ts:46`).
- 🧨 **Stop-mode volume backup causes downtime** — `turnOff` scales to 0 replicas, archives, restarts (`volume-backups/backup.ts:69-164`).
- 📝 **Scheduler is in-process and does not catch up missed runs.** `node-schedule` on the single control-plane process; enabled backups are rebuilt from DB on startup (survives restart), but any cron occurrence while the host is down is skipped — no backfill (no BullMQ/Redis).
- 📝 **Destination test always runs on the host, ignoring `runtimeWorkerId`** (`testConnection` `destination.ts:45` always `execAsync` locally) — a test can pass on the host while the worker that performs the backup can't reach the bucket.
- 🏗️ **Naming/label smells**: `databaseType` enum lists `web-server`; notification labels remap `mongo`→`mongodb` and `redis`→`postgres` placeholder (`backups/database.ts:33`). The compose restore branch reuses `input.databaseId` to carry a compose id (`backup.ts:391`).

---

## 10. Runtime, Cluster & Workers

### Feature → impl

| Feature | Implementation |
|---|---|
| Container runtime view | `routers/docker.ts` + `services/docker.ts` (shells `docker ps/inspect/logs` via `execAsync` / `execAsyncRemote`); UI `container-runtime/_client.tsx` |
| Runtime/build workers | `routers/runtime-worker.ts`; `services/runtime-worker.ts`; schema `db/schema/runtime-worker.ts` (`runtimeWorkerType` `deploy|build`, `buildsConcurrency`, `sshKeyId`); setup `setup/runtime-worker-setup.ts`; validate/audit `runtime-worker-{validate,audit}.ts` |
| SSH to remote workers | `setup/runtime-worker-setup.ts:247-318` (`ssh2` for setup); `utils/process/execAsync.ts:142-251` (`execAsyncRemote`); `utils/servers/remote-docker.ts` (dockerode-over-SSH) |
| Build-worker selection | schema `application.ts:220-231` (`runtimeWorkerId`,`buildRuntimeWorkerId`); decision `services/deployment.ts:177`; query `runtime-worker.ts:172` (`buildWorkers`) |
| Concurrent builds | `server/queues/` (partition by `runtimeWorkerId`) + `concurrency.ts` reads `buildsConcurrency` |
| Cluster | `routers/cluster.ts` (`getNodes/addWorker/addManager/removeWorker`) + `swarm.ts`; Swarm init `runtime-worker-setup.ts:353` |
| Docker resources/cleanup | `utils/docker/utils.ts:178-361` (prune map, `cleanupAll`); `runtime/docker-cleanup.ts` (daily `node-schedule` cron) |

### Notes

- 🐞 **Deploy queue partitions by the wrong worker when a build worker is set.** `routers/application.ts:349` (and `:348` redeploy) enqueue with `runtimeWorkerId: application.runtimeWorkerId ?? undefined`, ignoring `buildRuntimeWorkerId`. The build runs on the build worker (decided later, `services/deployment.ts:177`) but the job is queued in the **deploy** worker's partition and counted against the deploy worker's `buildsConcurrency`. If `runtimeWorkerId` is null but a build worker is set, the build serializes under the LOCAL partition. **Per-build-worker concurrency limits are effectively not honored.**
- 🚧 **No build worker for Compose** — `compose.ts` schema has only `runtimeWorkerId`, no `buildRuntimeWorkerId`, no build-worker UI. Build offload is application-only.
- 🧨 **Node removal is force-remove and leaves the node half-joined** (`cluster.ts:54-55` `docker node update --availability drain` with no wait, then `docker node rm --force`). The removed machine still thinks it's in the Swarm (needs manual `docker swarm leave`); removing a manager can break quorum.
- 🔒 **Remote command construction interpolates user-controlled values into SSH shell commands.** `services/docker.ts`/`cluster.ts` build `docker node rm ${input.nodeId}`, `docker inspect ${containerId}`, etc. Mitigations are uneven: container/app ids are validated against `containerIdRegex` at the router (`docker.ts:22`), but `cluster.removeWorker`'s `nodeId` (`cluster.ts:38`) has **no regex guard** before landing in `docker node update/rm ${input.nodeId}`.
- 🔒 **`getServerMetrics` is an open SSRF-shaped fetch** (`runtime-worker.ts:452-505`) — takes an arbitrary `url` + bearer `token` from the client and `fetch`es it server-side, gated only by `monitoring:read`. Any member with that permission can make the control plane issue authenticated GETs to arbitrary URLs.
- 📝 **The "server→runtimeWorker" rename is incomplete internally but does NOT leak into Docker/image names** (those are clean `docklands-*`). Internal remnants: `targetServer`/`isBuildServer` vars, OpenAPI path `/deploy/server-with-logs`, `updateRemoteServersOnly`/`remoteServersOnly`, `metricsConfig.runtimeWorker.type` enum `"Docklands"|"Remote"`.
- 📝 **`/dashboard/settings/build-workers` is the concurrency page, not a worker list** — remote workers are created/listed under `/dashboard/settings/runtime`.
- 📝 **`execAsyncRemote` SSH timeout is `99999`ms with a stray un-awaited `sleep(1000)`** (`execAsync.ts:157,248`) — the sleep is a no-op; the ~100s timeout is arbitrary.

---

## 11. Workspace Canvas (Projects, Environments, Connections)

### Feature → impl

| Feature | Implementation |
|---|---|
| Workspace CRUD / duplicate / homeStats / search | `routers/workspace.ts`; `services/workspace.ts` (auto-creates `production` env via `createProductionEnvironment`); schema `db/schema/workspace.ts` |
| Environment CRUD / duplicate / search | `routers/environment.ts`; `services/environment.ts`; schema `db/schema/environment.ts` |
| Canvas load | `workspaceGraph.byEnvironment` → `services/workspace-graph.ts:getEnvironmentWorkspace`; `shared/workspace-graph.ts:resolveWorkspaceNodes`; schema `db/schema/workspace-graph.ts` |
| Card position persistence | `workspaceGraph.updateNode` → `upsertWorkspaceNode`; table `workspace_service_layout` (unique env+type+id) |
| Connections | `workspaceGraph.{connect,removeConnection}`; `createWorkspaceConnection`, `normalizeWorkspaceConnectionEndpoints`; table `workspace_service_connection` (unique 4-tuple) |
| Generated connection variables | `workspaceGraph.{connectionVariables,applyConnectionVariables,syncServiceConnectionVariables}`; `getConnectionVariableEntriesFromSource` → `databaseConnectionVars` (registry); `upsertEnvironmentVariables` |
| Topology grouping (client-only) | `resolveWorkspaceConnectionGroups`, `countWorkspaceTopology` (`shared/workspace-graph.ts`) |
| Search / command bar | `search-command.tsx`; `shared/routes.ts:isEnvironmentCanvasPath` |

### Notes

- 🧨 **Canvas layout-persistence race (confirmed).** `environment-canvas.tsx:706-708` `useEffect` unconditionally overwrites local card positions with the server's on every `byEnvironment` refetch (each `updateNode` invalidates). No in-flight/optimistic guard, no debounce — a concurrent drag (second tab / teammate) whose save lands between your drag and refetch snaps your card back.
- 🧨 **Generated connection variables are a snapshot, not a binding.** `applyWorkspaceConnectionVariables` (`services/workspace-graph.ts:339`) computes from the source DB's current `config` and upserts into the target once. Nothing re-applies on rotation; `removeWorkspaceConnection` (`:234`) deletes only the link row, never retracts previously-written keys. After a DB password rotation every consumer silently holds stale credentials until manually re-applied + redeployed. (This is the same staleness thread as the Databases domain — the canvas is where it's most visible.)
- 🚧 **Environment "promotion" does not exist.** No promote/diff-and-apply. `environmentRouter.duplicate` copies the env record + vars but **not services** (`services/environment.ts:183`); the only service-copy path is `workspaceRouter.duplicate`.
- 🏗️ **Orphaned layout/connection rows tolerated, not cleaned.** `getEnvironmentWorkspace` filters out connections with missing endpoints (`:72-86`); `deleteWorkspaceNodesForMissingServices` (`:410`) exists but is **called from no router**. Stale `workspace_service_layout` rows persist (harmless; read path ignores them; env-FK cascade clears on env delete).
- 📝 **Applying/syncing vars does not redeploy** — `updateWorkspaceServiceEnv` only writes the `env` column; running container unaffected until next deploy.
- 📝 **Connection orientation is silently auto-flipped** (`normalizeWorkspaceConnectionEndpoints` `shared/workspace-graph.ts:141`) so a variable-capable DB is always the source; non-DB→non-DB connections produce zero variables.
- 🔒 **Permission gating here is consistent and correct** — variable-writing paths all `checkPermission(ctx, { envVars: ["write"] })`; `getAuthorizedEnvironment` enforces org scoping + per-member service filtering (`routers/workspace-graph.ts:55-87`); connection mutations `assertWorkspaceServiceExists` both endpoints. Positive finding.
- 📝 **List view is a thin `?view=workspaces` query-param toggle**; tags attach to **workspaces only** (`workspace_tag`), never environments/services/cards.

---
---

# Part II — Remediation Plan

> Companion to Part I. Part I is the *diagnosis*; this is the *treatment*. It
> encodes the decisions taken on 2026-06-23, defines the shared abstractions the
> decisions imply, sequences the work into phases, and maps **every** Part I
> finding to a disposition so nothing is silently dropped.

## Progress log

Tracks execution of the phases below. A ✅ in the phase table / disposition map
means shipped and green (`typecheck` + `test:ci`).

- **P0 — Pure bugs — ✅ done (2026-06-23).** Fixed A1, G1, S1, C3, N7, R8, A8,
  G7. Also fixed three **discovered** per-engine leftovers from the
  unified-database refactor (see *Discovered during remediation* below). All
  green: `tsc` clean, 82 test files / 656 tests pass, Biome clean.
- **P1 — Secrets at rest — ✅ done (2026-06-23).** Built abstraction ①:
  `crypto/secret-box.ts` (AES-256-GCM, versioned `v1:` envelope, lazy key,
  passthrough-on-plaintext) + `db/encrypted.ts` (`encryptedText`/`encryptedJson`
  Drizzle customTypes). Applied across the full **Secret-columns inventory**
  (G3, G4, N2, S2, S3, B2-store, D1-store, C2-store) — incl. fixing the lying
  `ssh-key` comment. Added a dedicated `DOCKLANDS_ENCRYPTION_KEY` /
  `_FILE` (resolver, `ensure-encryption-key` op wired into `setup`,
  `.env.example`, and the Configuration + Production docs incl. a "back up the
  key" warning). Migration `0007_calm_firedrake.sql` flips the two `config`
  columns json→text (the text→text swaps are no-ops, as designed). All green:
  `tsc` clean, 83 files / 666 tests pass (11 new crypto tests), Biome clean,
  `build` exits 0. **Deliberately left plaintext:** Better Auth tables (managed
  by its adapter / its own 2FA crypto), and `*.refreshToken` webhook tokens
  (looked up *by value*, so GCM's non-determinism would break the `WHERE`).

### Discovered during remediation

Issues not in the Part I survey, found while executing the plan. Tracked here so
they're not lost; each is dispositioned like a first-class finding.

| ID | Finding | Disposition |
|---|---|---|
| X1 | `environmentRouter` `filterEnvironmentServices` referenced removed per-engine arrays (`environment.libsql`/`.mariadb`/…) → **runtime crash** (`undefined.filter`) when a scoped (non-owner) member lists environments. | **✅ P0** — filter the unified `environment.database` array by `databaseId`. |
| X2 | `services/mount.ts` `createMount` set removed per-engine columns (`postgresId`/…) via object spread (bypassed tsc) → database mounts created via `mount.create` were **orphaned** (no FK set). | **✅ P0** — map all six managed engines to the unified `databaseId`. |
| X3 | Volume-backup create UI (`handle-volume-backups.tsx`) sent removed per-engine IDs + a stray `runtimeWorkerId: id`; the router resolves `serviceId` from `databaseId`, so **database volume backups were orphaned**. | **✅ P0** — send `databaseId` for all managed engines; drop the stray field. |
| X4 | `advance-breadcrumb.tsx` `SERVICE_QUERY_KEYS` listed dead per-engine route params. | **✅ P0** — trim to `applicationId`/`composeId`/`databaseId` (cosmetic). |

## Decisions locked

These four (plus the encryption-key choice) were decided deliberately and gate
everything below. The pre-release "no compatibility debt" latitude applies — we
build the clean end-state, not a bridge.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| **D-SECRETS** | Credentials at rest | **Encrypt** — match Coolify. A transparent `encryptedText()` column type over all secret columns *and* env-var values. | Coolify (the engine we model) encrypts ~everything via the Laravel `encrypted` cast / `APP_KEY`. We already have a symmetric primitive (`better-auth/crypto`) and now a dedicated key. Pre-release ⇒ trivial migration. |
| **D-KEY** | Encryption key source | **Dedicated `DOCKLANDS_ENCRYPTION_KEY`** (file/env), separate from `BETTER_AUTH_SECRET`. | Separates data-encryption from auth-signing; rotating the auth secret doesn't force a data re-encrypt. |
| **D-RBAC** | Threat model | **Hard boundary.** Per-member RBAC + resource-access is a real security boundary; close every per-service authz gap, scope API keys, sign webhooks. | A multi-user deploy control plane must not let a scoped member read/stream/act on resources outside their grant. |
| **D-QUEUE** | Queue & scheduler durability | **Postgres-backed durable jobs**, exposed through **one shared abstraction** used by deploys, schedules, and backups (no per-subsystem duplication). | Survives restarts, recovers interrupted deploys, backfills missed crons — without re-introducing Redis. |
| **D-CONNVAR** | Connection variables | **Binding** — re-resolve from the source's current config at deploy time; retract on disconnect. No stored snapshot as the source of truth. | Eliminates the staleness class entirely (rotation, disconnect) rather than patching propagation. |

**Posture defaults** (my recommendations — proceeding on these unless overridden):
provider parity → *document the GitHub-first asymmetry, don't invest yet*;
footguns → *guard the safety-critical, document the cosmetic*; naming →
*finish the `server→runtimeWorker` rename now (incl. the OpenAPI path), pick one
canonical audit `resourceType`*.

## Foundational abstractions (build these first)

Three of the decisions reduce to "build one primitive, apply it widely." These
are the long poles; everything in their phase hangs off them.

### ① `encryptedText()` — transparent column encryption (D-SECRETS, D-KEY)

A Drizzle `customType` that encrypts on write / decrypts on read, so call sites
stay unchanged — the Drizzle analog of Laravel's one-word `encrypted` cast.

```ts
// server/core/db/encrypted.ts  (sketch)
import { customType } from "drizzle-orm/pg-core";
import { encryptSecret, decryptSecret } from "@/server/core/crypto/secret-box";

// AES-256-GCM via DOCKLANDS_ENCRYPTION_KEY; output is versioned: "v1:<iv>:<tag>:<ct>"
export const encryptedText = (name: string) =>
  customType<{ data: string; driverData: string }>({
    dataType: () => "text",
    toDriver: (v) => encryptSecret(v),
    fromDriver: (v) => decryptSecret(v),
  })(name);

// JSON variant for credential blobs (database.config, service_database.config)
export const encryptedJson = <T>(name: string) => /* encrypt JSON.stringify(...) */;
```

- `secret-box.ts` wraps `node:crypto` AES-256-GCM; key loaded once from
  `DOCKLANDS_ENCRYPTION_KEY` (32-byte base64). A version prefix (`v1:`) leaves
  room for rotation later (re-encrypt migration, like `migrate-auth-secret`).
- Apply to the columns in the **Secret-columns inventory** below. No per-callsite
  changes — reads/writes already go through Drizzle.
- Pre-release: the migration just changes the column comment/type; existing dev
  data can be wiped (no backfill bridge).

### ② Durable job primitive (D-QUEUE)

One Postgres-backed queue + handler registry that the deploy queue, the cron
scheduler, and backups all sit on — replacing the in-memory `myQueue` and the
in-process `node-schedule` registrations.

```ts
// server/core/jobs/  (sketch)
// table: job(id, kind, payload jsonb, status, run_at, attempts, max_attempts,
//            partition_key, locked_by, locked_at, result, created_at)
registerHandler("deploy", deployHandler);
registerHandler("backup", backupHandler);
registerHandler("schedule.tick", scheduleHandler);

await jobs.enqueue("deploy", payload, { partitionKey: buildWorkerId });   // concurrency by partition
await jobs.schedule("backup", payload, { cron, timezone });               // materializes due rows

// worker loop: SELECT … FOR UPDATE SKIP LOCKED where run_at<=now() and status='queued'
// boot: release stale locks; mark in-flight 'running' deploys as 'interrupted';
//       catch up cron rows whose run_at passed while down.
```

- Fixes the build-worker concurrency bug for free: `partitionKey` keys on the
  **build** worker, not the deploy worker.
- Schedules survive restart *and* backfill; History (DB) and Queue stop diverging
  because the queue *is* the DB.

### ③ Connection-variable resolver (D-CONNVAR)

A pure function that computes a target service's connection env from its current
upstream connections at deploy time, merged into the build env — not persisted.

```ts
// server/core/services/connection-vars.ts  (sketch)
// at deploy: resolveConnectionEnv(service) → reads inbound workspace_service_connection
//   rows, pulls each source DB's *current* config via the registry, returns entries.
// merged into prepareEnvironmentVariables() output for the container.
// disconnect: delete the connection row — nothing to retract (nothing was stored).
// UI "applied vars" becomes a read-only preview computed the same way.
```

- Removes D2 / W2 / W5 entirely. A password rotation is reflected on the next
  deploy with no manual re-apply.

## Phased sequence

Ordering favors fast wins first, then the abstractions in dependency order, then
the cleanup. Phases are independently shippable and each ends green
(typecheck + tests + build).

| Phase | Theme | Builds / changes | Closes (Part I IDs) |
|---|---|---|---|
| **P0** ✅ | Pure bugs | spot fixes, no new abstraction | A1, G1, S1, C3, N7, R8, A8, G7 (+ X1–X4) |
| **P1** ✅ | Secrets at rest | abstraction ① + apply to inventory + `DOCKLANDS_ENCRYPTION_KEY` + docs | G3, G4, N2, S2, S3, B2(store), D1(store), C2(store) |
| **P2** | Shell-exec safety | `shellArg`/arg-array sweep + secrets off cmdline | A2, A10, D4, N3, G5, R4, B2(cmdline) |
| **P3** | Durable jobs | abstraction ② (queue + scheduler + backups) | O6, B7, R1 |
| **P4** | RBAC hard boundary | per-service authz everywhere + API-key scope + webhook signing | AC1, O2, O3, R5, AC2, AC4, AC5, AC6, G2, AC3, C2(read) |
| **P5** | Connection-var binding | abstraction ③ | D1(expose), D2, W2, W5 |
| **P6** | Keep / cut | finish or remove the 8 half-built features | O1, C1, O5, S5, AC9, B1, R2, W3 |
| **P7** | Guardrails + consistency | guard safety-critical footguns; finish rename; canonical taxonomy | N1, N4, N5, N6, A3, A4, D3, D5, B3, B4, B5, B6, B8, B9, C4, C5, C6, C7, C8, C9, R3, R6, W1, W4, S4, A5/O7, N8, N9, A6, A7, A12, G6, G8, W6 |

### Phase detail

**P0 — Pure bugs.** `runtimeWorker {`→`server {` in `builders/static.ts`; GitLab
`/api/v4/workspaces`→`/projects`; render the missing `serverThreshold` toggle;
make `extractDatabaseCredentials` fail/warn instead of defaulting; reconcile the
`publishMode` default; drop the dead `sleep`/fix the 99999 timeout; neutral
`disconnectGitProvider` state; real `bitbucket.isConfigured`.

**P1 — Secrets at rest.** Build ①; flip the **Secret-columns inventory** to
`encryptedText`/`encryptedJson`; add `DOCKLANDS_ENCRYPTION_KEY` to `.env.example`,
`ensure-auth-secret`-style generation in `setup`, and the
[Configuration](../apps/docs) page; fix the lying `ssh-key.ts:42` comment.

**P2 — Shell-exec safety.** A single `shellArg()` helper (or arg-array exec); pipe
secrets via stdin/files not `echo`; per-clone temp paths (kill the `/tmp/id_rsa`
race); validate `nodeId`; keep the DB password regex *and* escape; pull S3 creds
and build secrets off the command line into env/secret mounts.

**P3 — Durable jobs.** Build ②; migrate deploy enqueue, `initCronJobs`, and
backup scheduling onto it; add boot-recovery + missed-cron catch-up; partition by
build worker.

**P4 — RBAC hard boundary.** Add `checkServiceAccess` to the build-log and docker
WS streams; gate request-analytics reads behind `monitoring:read`/admin; remove or
allow-list `getServerMetrics` (note: cutting paid metrics in P6 removes this
surface); introduce per-API-key permission scope; org-level "require 2FA"; fix the
roles-page gating altitude and the `assignPermissions` ownership check; verify
webhook signatures where providers support it; scope "Delete User" to the org (or
warn loudly).

**P5 — Connection-var binding.** Build ③; delete the persisted-snapshot apply path;
make disconnect a pure row delete; turn the UI "applied vars" into a computed
preview.

**P6 — Keep / cut.**
- **Finish:** audit log (implement the two stubs + a viewer); bare-DB templates
  (ship ~6 single-engine catalog files so the routing goes live).
- **Cut:** remote/"paid" metrics path (also removes the SSRF surface); registry
  `cloud`/`selfHosted` vestiges; `user.role` + `admin()`/impersonation vestiges;
  libSQL *logical* backup (volume-backup only — drop it from the backup enums/UI).
- **Defer (tracked, not now):** environment promotion; Compose build worker.

**P7 — Guardrails + consistency.** Require an LE email before enabling Let's
Encrypt; take a pre-restore snapshot; validate proxy-file edits + warn on
generated-file clobber; clarify the cert-provider naming (`custom` resolver vs
uploaded file); drain-wait + quorum guard on node removal; surface
retention/cleanup errors and sort retention by mtime; honor `runtimeWorkerId` in
destination tests; couple `publishDirectory`/SPA and validate drop+buildType;
single detection call site; robust catalog header parsing; finish the
`server→runtimeWorker` rename incl. the OpenAPI path; one canonical audit
`resourceType`; fix the backups naming smells; debounce + optimistic-guard the
canvas layout save; clean orphaned layout rows; org-scope the restart
notification; document provider parity + CDN-validation + stop-mode downtime.

## Secret-columns inventory (P1 target) — ✅ applied

`encryptedText` / `encryptedJson` applied to these (mirrors Coolify's set):

| Table.column | Source finding |
|---|---|
| `ssh_key.privateKey` (+ fix comment) | G3 |
| `github.*` (privateKey, clientSecret, webhookSecret), `gitlab/gitea` (tokens, clientSecret), `bitbucket` (appToken) | G4 |
| `certificate.certificateData`, `certificate.privateKey` | N2 |
| `registry.password` | S2 |
| `notification.*` secrets (SMTP password, bot tokens, webhook URLs, Resend/Pushover/Gotify/ntfy) | S3 |
| `destination.accessKey`, `destination.secretAccessKey` | B2 |
| `database.config` (password/rootPassword), `service_database.config` | D1, C2 |
| env storage: `application.env`, `compose.env`, `database.env` (+ build args) | Coolify parity (env values) |
| `security.password` (basic-auth, must stay reversible for Traefik) | — |

## Full finding → disposition map

Every Part I note, accounted for. (Positives and intentional-design notes are
"no action".)

| ID | Finding (short) | Disposition |
|---|---|---|
| A1 | nginx `runtimeWorker {` token | **✅ P0** |
| A2 | build secrets exported as plain env | **P2** |
| A3 | publishDir + SPA no coupling | **P7 guard** |
| A4 | drop + buildType unvalidated | **P7 guard** |
| A5 | audit resourceType inconsistent | **P7 (canonical taxonomy)** |
| A6 | rollbacks inert; image-less row leak | **P7 fix** |
| A7 | paketo/railpack version pinning | **P7 (railpack: configurable)** |
| A8 | disconnect resets to github | **✅ P0** (→ neutral `git`, app + compose) |
| A9 | env reference resolution order | no action (documented) |
| A10 | patch filePath shell interpolation | **P2** |
| A11 | patches re-apply conflicts | no action (documented) |
| A12 | patch audit resourceType:settings | **P7 (taxonomy)** |
| D1 | conn vars embed plaintext password | **✅ P1 (store)** + P5 (expose) |
| D2 | password change no propagation | **P5** |
| D3 | external-port TOCTOU | **P7 (best-effort + clear error)** |
| D4 | changePassword shell interpolation | **P2** |
| D5 | backup UI hardcodes engines | **P7 (registry-drive)** |
| D6 | redis/libsql no logical backup | no action (by design) |
| D7 | config jsonb validated at boundary | no action (positive) |
| D8 | mysql/mariadb dumps as root | no action (note) |
| C1 | bare-DB routing dead in catalog | **P6 finish (ship templates)** |
| C2 | compose creds plaintext/served | **✅ P1 (store)** + P4 (read perm) |
| C3 | extractDatabaseCredentials defaults | **✅ P0** (throws for auth-required engines; caller skips + warns) |
| C4 | backup user/password engine quirk | **P7 fix** |
| C5 | detection runs twice | **P7 (single call site)** |
| C6 | stack stop/start asymmetry | **P7 (add start path)** |
| C7 | delete swallows cleanup errors | **P7 (surface errors)** |
| C8 | catalog header parsing fragile | **P7 (robust parse)** |
| C9 | libsql embedded detection weak | **P7 (note/strengthen)** |
| N1 | "custom" cert provider ≠ upload | **P7 (UI clarity)** |
| N2 | cert private keys plaintext | **✅ P1** |
| N3 | remote traefik write interpolation | **P2** |
| N4 | placeholder ACME email | **P7 guard (require email)** |
| N5 | LE prod-only + rate-limit | **P7 (doc + dev resolver)** |
| N6 | proxy-file editing can brick ingress | **P7 guard (validate)** |
| N7 | port default contradiction | **✅ P0** (zod default → `host`, matches column + runtime) |
| N8 | domain validation CDN gap | **P7 (doc)** |
| N9 | redirects application-only | no action (note) |
| G1 | GitLab `/api/v4/workspaces` | **✅ P0** (→ `/api/v4/projects`) |
| G2 | refresh-token webhook no signature | **P4 (sign/verify)** |
| G3 | SSH keys plaintext + wrong comment | **✅ P1** (+ comment fixed) |
| G4 | all provider creds plaintext | **✅ P1** |
| G5 | SSH key echo interpolation + race | **P2** |
| G6 | provider parity uneven | **P7 (document)** |
| G7 | bitbucket isConfigured false | **✅ P0** (derives from apiToken + email) |
| G8 | provider URLs from window.origin | **P7 (use configured URL)** |
| AC1 | docker WS skip per-service access | **P4** |
| AC2 | API keys full identity | **P4 (per-key scope)** |
| AC3 | "Delete User" global delete | **P4 (scope/warn)** |
| AC4 | 2FA not enforceable org-wide | **P4 (require-2FA)** |
| AC5 | roles page under-gates | **P4 fix** |
| AC6 | assignPermissions near-no-op check | **P4 fix** |
| AC7 | custom-role multi-row merge | no action (by design) |
| AC8 | owner-role sealing consistent | no action (positive) |
| AC9 | user.role + admin vestiges | **P6 cut** |
| O1 | audit log no-op | **P6 finish** |
| O2 | build-log WS no authz | **P4** |
| O3 | request-analytics read gate | **P4** |
| O4 | metrics only while watched | **P7 (doc; opt. collector)** |
| O5 | remote/paid metrics half-wired | **P6 cut** |
| O6 | in-memory queue loses state | **P3** |
| O7 | audit resourceType inconsistency | **P7 (= A5)** |
| O8 | request analytics 1000-line window | no action (note) |
| O9 | host metrics Linux-only | no action (note) |
| S1 | serverThreshold no UI toggle | **✅ P0** (render the toggle) |
| S2 | registry passwords plaintext | **✅ P1** |
| S3 | notification secrets plaintext | **✅ P1** |
| S4 | restart notif not org-scoped | **P7 fix** |
| S5 | registry cloud/selfHosted vestiges | **P6 cut** |
| S6 | registry delete nulls refs | no action (note) |
| S7 | tags workspace-only / bulkAssign | no action (note) |
| S8 | per-app security is basic-auth | no action (note) |
| B1 | libSQL DB backup broken | **P6 cut (volume-only)** |
| B2 | S3 creds plaintext + cmdline | **✅ P1 (store)** + P2 (cmdline) |
| B3 | retention errors swallowed | **P7 (surface)** |
| B4 | retention sorts by filename | **P7 (sort by mtime)** |
| B5 | restore destructive no snapshot | **P7 guard (pre-snapshot)** |
| B6 | stop-mode volume backup downtime | no action (documented) |
| B7 | scheduler no catch-up | **P3** |
| B8 | destination test ignores worker | **P7 fix** |
| B9 | backups naming smells | **P7 cleanup** |
| R1 | deploy queue wrong partition | **P3** |
| R2 | no build worker for compose | **P6 defer** |
| R3 | node removal force-rm | **P7 guard (drain-wait/quorum)** |
| R4 | nodeId no regex guard | **P2** |
| R5 | getServerMetrics SSRF | **P4 (+ removed by P6 cut)** |
| R6 | server→runtimeWorker rename | **P7 (finish rename)** |
| R7 | build-workers route is concurrency | no action (documented) |
| R8 | execAsyncRemote timeout + dead sleep | **✅ P0** (drop sleep; timeout 30s; rm dead var) |
| W1 | canvas layout race | **P7 (debounce + guard)** |
| W2 | conn vars snapshot not binding | **P5 (= D2)** |
| W3 | environment promotion absent | **P6 defer** |
| W4 | orphaned layout rows | **P7 (call cleanup)** |
| W5 | apply/sync doesn't redeploy | **P5 (binding resolves)** |
| W6 | connection orientation auto-flip | **P7 (doc/UI hint)** |
| W7 | permission gating correct | no action (positive) |
| W8 | list view toggle / tags scope | no action (note) |

## Keep / cut ledger

| Feature | Call | Action |
|---|---|---|
| Audit log | **Finish** | implement `createAuditLog`/`getAuditLogs` + a viewer page |
| Bare-DB → managed template routing | **Finish** | ship ~6 single-engine catalog templates |
| libSQL logical backup | **Cut** | remove from backup enums/UI; volume-backup only |
| Remote/"paid" metrics | **Cut** | delete `metrics/paid/**` + `getServerMetrics` (kills SSRF) |
| Registry `cloud`/`selfHosted` | **Cut** | drop dead enum + `apiEnableSelfHostedRegistry` |
| `user.role` / `admin()` / impersonation | **Cut** | remove vestigial column, fields, impersonation bar |
| Environment promotion | **Defer** | tracked; real feature, design separately |
| Compose build worker | **Defer** | tracked; parity gap, not broken |

## Sequencing notes

- **P1 before P2** on the storage/cmdline split: encrypt at rest first, then stop
  leaking the same secrets onto the command line.
- **P3 before/with R1**: the build-worker concurrency bug is most cleanly fixed by
  the durable queue's `partitionKey`, not a one-off patch.
- **P4 and P6 overlap** on `getServerMetrics`: P6's "cut paid metrics" removes the
  SSRF surface; if P4 ships first, gate it, then delete in P6.
- **P5 depends on P1** only loosely (binding reads `database.config`, which P1
  encrypts transparently — no ordering constraint beyond the column type existing).
- Each phase is its own PR-sized unit and must end green
  (`typecheck` + `test:ci` + `build`), matching the existing commit discipline.






