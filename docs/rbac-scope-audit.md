# Docklands RBAC & Scope Boundary Audit

Status: audit + actionable plan. Authored during the Dokploy → Docklands transition.

This document defines the three intended scopes — **instance**, **organization**,
**project** — maps the current code against them, identifies boundary violations,
and lists concrete, ordered work items.

### Locked decisions (Phase 0)
- **D1 — Single organization per instance.** Multi-org is treated as Better Auth
  plumbing only; we do not build cross-tenant isolation. Consequence: the
  *instance operator* and the *org owner/admin* are the **same identity**, so F1
  is **no longer a cross-tenant security hole** and a separate instance role is
  **not** required now. The live boundary is **org-admin vs scoped member**.
- **D2 — Access-control statements + custom roles are the source of truth.**
  Finish `custom-role.ts`, migrate legacy member boolean/array flags into roles,
  and remove the dual permission path.
- **D3 — API-key scoping is moot under single-org.** Keep keys user-global;
  revisit only if D1 ever changes.

These choices re-order the plan in §4: the host-boundary phase shrinks to a
cleanup, and **org-RBAC coherence + project-level RBAC become the main work**.

### Implementation status (branch `rbac-scope-boundaries`)
- **Phase 1 — DONE.** `toggleRequests` and `updateLogCleanup` moved to
  `adminProcedure`; `getWebServerSettings` no longer returns the host SSH private
  key; WS container streams (logs/stats/terminal) now require `docker:read` and
  the host shell requires owner/admin (`server/wss/utils.ts` helpers). Covered by
  `__test__/wss/ws-access.test.ts`.
- **Phase 2 — DONE.** `custom-role.ts` CRUD implemented against `organization_role`
  with permission validation against the AC statements. Enforcement covered by the
  new "custom roles" cases in `__test__/permissions/check-permission.test.ts`.
- **Phase 3 — DONE.** Per-member resource access normalized into the
  `member_resource_access` table (migration 0001 with backfill). `permission.ts`
  projects it back to the legacy array shape via `loadResourceAccess` so all call
  sites are unchanged; writers and the two direct readers
  (git-provider/runtime-worker) go through the join table. Behavior-preserving.
- **F5 — DONE.** The 11 per-member boolean flags removed (migration 0002); the
  dual permission path is gone, so capabilities come only from the role. The
  member-permissions editor now manages resource access only, and a full role
  manager at `/dashboard/settings/roles` (resource × action matrix) lets admins
  create/edit/delete custom roles. Members default to read-only.

---

## 1. The three scopes (target model)

| Scope | Owns | Who should administer it |
| --- | --- | --- |
| **Instance** (the server/VM itself) | The host: Docker daemon, Traefik/ingress runtime, server IP/main domain, Let's Encrypt email, host SSH key, Docker prune/cleanup, GPU, Docklands version/self-update, Redis/queue reset, `remoteServersOnly`, build concurrency of the local node, infrastructure health. One physical truth shared by every org. | A small set of **instance operators** (super-admins). Must be a *separate* identity from "owner of an organization". |
| **Organization** (a tenant) | Members & roles, registries, destinations (S3), certificates, SSH keys, notifications, git providers, runtime/cluster workers (remote VMs), tags, API keys, audit log. Shared across all the org's projects. | Org **owner/admin**, with member-level RBAC below them. |
| **Project / workspace** (a unit of work) | Workspaces → environments → services (apps, compose, postgres/mysql/redis/mongo/mariadb/libsql), domains, mounts, ports, deployments, previews, the canvas graph. | Org members granted access to *that* workspace/service. |

The data model already roughly follows this nesting:
`organization → workspace → environment → service`, plus org-scoped shared
resources and a singleton instance-config table. The **enforcement layer does
not** — see §3.

---

## 2. Current state (verified)

### Identity & role resolution
- Better Auth with `organization`, `apiKey`, `twoFactor` plugins. The `admin()`
  plugin (global super-admin via `USER_ADMIN_ID`) is **only loaded when
  `IS_CLOUD`** — so self-hosted has **no global admin plugin**.
  `server/core/lib/auth.ts:351-357`.
- `user.role` (global column, default `"user"`) exists
  (`server/core/db/schema/user.ts:53`) **but is overwritten at session time**
  with the active-org member role: `session.user.role = member?.role || "member"`
  (`server/core/lib/auth.ts:493`). So by the time a request reaches tRPC,
  `ctx.user.role` means "my role in my active organization", never an
  instance-level role.

### tRPC guards (`server/api/trpc.ts`)
- `publicProcedure` — none.
- `protectedProcedure` — authenticated only (`:203`).
- `adminProcedure` / `cliProcedure` — `role === "owner" || "admin"` (`:217`,`:235`).
  **This is an org role check, not an instance check.**
- `withPermission(resource, action)` — fine-grained RBAC via `checkPermission`
  against the access-control statements (`:267`).

### Access-control statements & roles (`server/core/lib/access-control.ts`)
- Resources: `workspace, service, environment, docker, sshKeys, gitProviders,
  traefikFiles, registry, certificate, destination, notification, runtimeWorker,
  tag, member, organization, …` with owner/admin/member matrices.
- Member defaults are read-only; legacy boolean flags
  (`canCreateWorkspaces`, `canAccessToDocker`, `accessedServices[]`, …) on the
  `member` row (`server/core/db/schema/account.ts:132-171`) are mapped into
  permissions inside `permission.ts:127-161`.

### Scope of data (verified in `server/core/db/schema/`)
- **Instance singleton:** `webServerSettings` — no `organizationId`; holds
  serverIp, certificateType, letsEncryptEmail, host SSH key, Docker cleanup,
  metrics, `remoteServersOnly`, build concurrency. (`web-server-settings.ts`).
- **Org-scoped:** member, organizationRole, invitation, runtimeWorkers,
  registry, destination, certificate, sshKeys, notification, gitProvider, tag,
  schedule(some). All carry `organizationId`.
- **Project-scoped:** workspace → environment → application/compose/postgres/…,
  domain, mount, port, security, redirects, patch, previewDeployments,
  deployment.
- **User/instance-global:** user, account, session, apikey (`referenceId → user`,
  **not** org-scoped), twoFactor.

---

## 3. Boundary violations & gaps (findings)

### F1 — DOWNGRADED under single-org (D1): instance ops gated by org role
Every host-mutating procedure in `settings.ts` uses `adminProcedure`, which only
proves the caller is owner/admin of **their active org**. There is no instance
operator concept. Affected (non-exhaustive): `updateServerIp`, `assignDomainServer`,
`saveSSHPrivateKey`/`cleanSSHPrivateKey`, `updateTraefikConfig` /
`updateWebServerTraefikConfig` / `updateMiddlewareTraefikConfig`, `writeTraefikEnv`,
`updateTraefikPorts`, `toggleDashboard`, `cleanUnusedImages|Volumes|StoppedContainers|DockerBuilder|DockerPrune|All`, `reloadServer`, `reloadRedis`, `cleanRedis`,
`reloadTraefik`, `cleanAllDeploymentQueue`, `updateServer` (self-update),
`updateRemoteServersOnly`, `updateBuildsConcurrency`, `setupGPU`.

**Impact under D1 (single-org):** the org owner/admin *is* the instance operator,
so gating host ops to `adminProcedure` (owner/admin) is **acceptable** — there is
no other tenant to harm. F1 reduces to "ensure non-admin members can't reach host
ops", which `adminProcedure` already enforces. **No separate instance role needed.**
(If D1 ever flips to multi-org, F1 returns to CRITICAL and Phase 1-multi-org below
applies.)

### F2 — No instance role exists to grant
Moot under D1: owner/admin already serves as the operator identity. The
session-time role overwrite (`auth.ts:493`) is harmless with one org. Leave as-is.

### F3 — `webServerSettings` singleton governed by org owner/admin
The table has no `organizationId`; it is genuinely instance state. Under D1 it is
correctly owned by the single org's owner/admin. Action narrows to: ensure **reads
of host secrets** (host SSH key) aren't exposed to non-admin members (see F6).

### F4 — Custom roles are half-built
DB (`organizationRole`) + Better Auth `dynamicAccessControl` (max 10 roles) are
wired, but `server/api/routers/custom-role.ts` throws "not implemented" on every
mutation. Orgs cannot actually define custom roles, so the only real roles are
owner/admin/member + legacy boolean flags.

### F5 — Two parallel permission systems coexist
Static AC statements (`access-control.ts`) **and** legacy member boolean/array
flags (`canAccessToDocker`, `accessedServices[]`, …) both feed `checkPermission`.
This is transition debt: confusing, easy to get inconsistent, and hard to audit.
Pick one model.

### F6 — Inconsistent guard usage for the same logical resource
Traefik/ingress is split: file edits use `withPermission("traefikFiles", …)` on
`protectedProcedure`, while config/env/ports edits use `adminProcedure`. Same
resource, two different gates. Several DB-mutating settings procedures
(`updateLogCleanup`, `toggleRequests`) run on `protectedProcedure` with no
role/permission check at all.

### F7 — API keys are user-global, not org-scoped
`apikey.referenceId → user`. A key mints a session whose org is derived from
membership lookup, but the key itself isn't bound to one org. Cross-org key
semantics are undefined and should be made explicit.

### F8 — WebSocket/stream handlers check org membership but not resource RBAC
Handlers (e.g. `wss/docker-container-logs.ts`) verify
`runtimeWorker.organizationId === session.activeOrganizationId` but never call
`checkServiceAccess`/`checkPermission`. A read-only member can stream logs for
services they were never granted, as long as they're in the org.

### F9 — `git-provider` ownership is a third, ad-hoc scope
`gitProvider` carries both `userId` and `organizationId` plus a
`sharedWithOrganization` flag, gated by bare `protectedProcedure` with an inline
ownership check. It's neither cleanly user- nor org-scoped. Decide and normalize.

### F10 — No project-level role grant primitive
Project access for members is expressed only as ID arrays on the member row
(`accessedWorkspaces/Services/Environments`). There is no "role on a project"
concept, no per-project admin, and empty-array semantics ("all" vs "none") are
undocumented. This won't scale to real project RBAC.

---

## 4. Actionable plan (ordered, single-org per D1)

Re-ordered for D1: there is no cross-tenant hole, so the work is (1) plug
member-vs-admin leaks, (2) make the org permission model coherent on AC, then
(3) build real project-level RBAC. A separate instance-operator phase is deferred
unless D1 flips.

### Phase 1 — Plug member-vs-admin leaks (F6; touches F3, F8)
The only live "instance/org vs member" boundary failures today are procedures
that mutate shared/host state on bare `protectedProcedure`, and streams that skip
per-service checks. Quick, high-value, low-risk.
1. Audit `settings.ts` for DB/host mutations on `protectedProcedure` and re-gate
   to `adminProcedure` (or `withPermission`). Known: `updateLogCleanup`,
   `toggleRequests`. Sweep the whole router for siblings.
2. Ensure host-secret reads (host SSH key via `getWebServerSettings`) are not
   returned to non-admin members (F3).
3. Normalize Traefik: file edits and config/env/ports edits should share one gate
   (F6) — pick `adminProcedure` for all host-config writes.
4. Add `checkServiceAccess`/`checkPermission` to WS/stream handlers so a
   read-only member can't stream logs for services they weren't granted (F8).

### Phase 2 — Make org RBAC coherent on AC statements (D2; F4, F5, F9)
1. Implement `custom-role.ts` against `organizationRole` + Better Auth
   `dynamicAccessControl` (already enabled, max 10 roles).
2. Migrate legacy member boolean/array flags
   (`canAccessToDocker`, `accessedServices[]`, …) into AC roles; remove the dual
   path in `permission.ts:127-161`. Generate a Drizzle migration for dropped
   columns and commit the `drizzle/meta` snapshot.
3. Normalize git-provider (F9): under D1 make it cleanly org-scoped; drop the
   per-user `sharedWithOrganization` ambiguity or document it as org-default.

### Phase 3 — Real project-level RBAC (F10) — the main boundary
This is where "per-project settings" actually gets teeth under single-org.
1. Replace the member-row ID arrays
   (`accessedWorkspaces/Services/Environments`) with a project (workspace)
   membership/role primitive. Document empty-set semantics during migration.
2. Define per-project roles layered under org roles
   (e.g. project-admin / deployer / viewer).
3. Make environment/service/deployment checks consult project roles uniformly,
   including in WS handlers from Phase 1.

### Phase 4 — Hardening & tests
- Tighten secret reads (host SSH key, provider tokens) to owner/admin only.
- Add `__test__/` coverage per boundary: a scoped member cannot hit host/settings
  ops; a project viewer cannot deploy or stream another project's logs; custom
  roles authorize exactly their statements. Security-sensitive per
  `server/core/AGENTS.md`.
- API-key scoping (F7): no action under D1; revisit only if multi-org returns.

### Deferred — Instance-operator role (only if D1 → multi-org)
If the product ever hosts multiple orgs: stop the role overwrite at
`auth.ts:493`, add `instanceProcedure` checking a durable instance role, and
re-gate the §5 host-op list from `adminProcedure` → `instanceProcedure`.

---

## 5. Quick reference — host-op procedures

Under D1 these stay on `adminProcedure` (owner/admin = instance operator). They
become the re-gating list for the **deferred instance-operator phase** only if D1
flips to multi-org. They are listed here so Phase 1 can confirm none have slipped
to bare `protectedProcedure`. In `server/api/routers/settings.ts`:
`updateServerIp, assignDomainServer, saveSSHPrivateKey, cleanSSHPrivateKey,
updateTraefikConfig, updateWebServerTraefikConfig, updateMiddlewareTraefikConfig,
writeTraefikEnv, updateTraefikPorts, toggleDashboard, cleanUnusedImages,
cleanUnusedVolumes, cleanStoppedContainers, cleanDockerBuilder, cleanDockerPrune,
cleanAll, updateDockerCleanup(instance-wide branch), reloadServer, reloadRedis,
cleanRedis, reloadTraefik, cleanAllDeploymentQueue, updateServer,
updateRemoteServersOnly, updateBuildsConcurrency, setupGPU, checkGPUStatus,
checkInfrastructureHealth, getDocklandsCloudIps`.

Stays org-scoped (`withPermission`): registry, destination, certificate,
notification, sshKey, runtimeWorker, tag, member, git-provider.
