---
title: Roles & permissions
description: Built-in and custom roles, the capability matrix, and per-member resource access in Docklands.
---

Docklands authorization has **two independent layers**, and a member needs both
to do something:

1. **Capabilities (roles)** — *what kinds of actions* a member may perform, as a
   matrix of resource × action (for example `service:read`, `deployment:create`,
   `registry:delete`). Capabilities come from the member's role.
2. **Resource access (per-member grants)** — *which specific* workspaces,
   environments, services, git providers, and runtime workers a member may touch.

A read-only member who is granted `deployment:create` (via a custom role) still
cannot deploy a service they were never granted access to, and vice versa. Owners
and admins **bypass the resource-access layer entirely** and can reach everything
in the organization.

## Built-in roles

| Role | Capabilities | Resource scope |
| --- | --- | --- |
| **owner** | Everything, including deleting the organization. | All resources. |
| **admin** | Everything except deleting the organization. | All resources. |
| **member** | Read-only at the org level; full control *within* services they're granted (deployments, env vars, volumes, backups, schedules, domains, logs, monitoring). Cannot manage org-level resources (runtime workers, registries, certificates, destinations, notifications, SSH keys, git providers, members). | Only explicitly granted workspaces / environments / services. |

The built-in roles cannot be edited or deleted. Their exact matrices live in the
canonical access-control statements; the **member** baseline grants
`service:read`, `environment:read`, and a service-level set
(`deployment`, `envVars`, `volume`, `backup`, `volumeBackup`, `schedule`,
`domain`, `logs`, `monitoring`, `tag:read`) while leaving org-administration
actions empty.

## The capability matrix

Capabilities are expressed as **resource → allowed actions**. The full resource
list (and the actions each supports) is the single source of truth that custom
roles are validated against:

- **Project/workspace:** `workspace` (create, delete), `environment` (create,
  read, delete), `service` (create, read, delete)
- **Deployments & runtime:** `deployment` (read, create, cancel),
  `docker` (read), `logs` (read), `monitoring` (read)
- **Service config:** `envVars`, `workspaceEnvVars`, `environmentEnvVars`
  (read, write), `volume`, `domain` (read, create, delete),
  `backup` / `volumeBackup` (read, create, update, delete, restore),
  `schedule` (read, create, update, delete)
- **Org infrastructure:** `runtimeWorker`, `registry`, `destination`,
  `sshKeys`, `gitProviders` (read, create, delete), `certificate`,
  `notification` (read, create, update, delete), `tag`, `traefikFiles`
  (read, write)
- **Administration:** `member` (read, create, update, delete),
  `organization` (update, delete), `invitation` (create, cancel),
  `auditLog` (read), `api` (read)

`api:read` is what reveals the API/CLI keys panel on your profile.

## Custom roles

When the three built-in roles aren't enough, define a **custom role** with an
exact capability set. Manage them at **Settings → Roles**
(`/dashboard/settings/roles`). Creating, editing, and deleting custom roles
requires **owner or admin**.

To create one, give it a name and tick the resource/action checkboxes you want.
The chosen permissions are validated server-side against the canonical
statements, so a role can never be saved with an unknown resource or action.
You can have up to **10 custom roles per organization**.

Editing a role:

- **Rename** propagates: every member holding the old role name is moved to the
  new name in the same transaction.
- **Permission changes** replace the role's entire permission set.
- You cannot name a custom role `owner`, `admin`, or `member`, and you cannot edit
  the built-in roles.

Deleting a role **demotes** every member who held it back to the base `member`
role (they keep their per-resource grants but lose the custom capabilities).

:::note
Custom roles grant capabilities org-wide; they do **not** by themselves widen
which specific services a member can see. A member with a powerful custom role
still only acts on the resources granted to them under **Add Permissions** —
unless they are owner/admin, who bypass scoping.
:::

## Per-member resource access

Capabilities decide *what a member can do*; **resource access** decides *which
resources they can do it to*. Grant access from the Users page via **Add
Permissions** for a member. You can select, with auto-rollup between the levels:

- **Workspaces** the member can open,
- **Environments** within those workspaces,
- **Services** (applications, databases, compose) within those environments,
- **Git providers** the member can use,
- **Runtime workers** the member can target.

These grants are stored normalized in a `member_resource_access` table (one row
per granted resource). The **empty set means no access** (deny by default) for
members — a brand-new member sees nothing until you grant something. Owners and
admins ignore this table and see everything.

Under the hood, permission checks combine both layers. For example, reading a
service runs the `service:read` capability check **and** confirms the service id
is in the member's granted set (skipped for owner/admin). Creating a service
checks `service:create` **and** that the member has access to the target
workspace.

:::caution
Resource scoping is enforced at the tRPC/API layer, but a few raw streaming
endpoints are coarser. Container **log, terminal, and stats** WebSocket streams
gate on the org-wide `docker:read` capability and organization membership — they
do **not** re-check per-service access. A member granted `docker:read` can
therefore stream logs/stats for containers belonging to services they were not
explicitly granted, as long as they are in the organization. Grant `docker:read`
(and host-terminal access, which is owner/admin only) accordingly. Do not rely on
per-service scoping to hide container output from a member who has `docker:read`.
:::

## How a permission check resolves

1. Docklands looks up your membership in the active organization to find your
   role.
2. It resolves that role to a capability set — built-in roles use their fixed
   matrix; a custom role is assembled from its stored permissions.
3. It authorizes the requested resource/action against that set. Failing this
   returns an "unauthorized" error.
4. For resource-scoped operations it then checks the `member_resource_access`
   grants (owner/admin skip this step).

You can see your own resolved capabilities reflected in the dashboard — pages and
controls hide or disable themselves based on what your role allows.
