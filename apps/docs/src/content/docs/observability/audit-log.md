---
title: Audit Log
description: Who-did-what tracking for organization actions — the intended model and its current status.
---

The audit log is Docklands' record of **who did what**: which user, with which
role, performed which action on which resource, and when. It is scoped per
organization and intended for reviewing security-sensitive changes such as
deployments, role edits, settings changes, and resource deletions.

:::caution[Not yet functional]
Audit logging is **wired through the application but does not persist anything**
in the current build. The write path (`createAuditLog`) and the read path
(`getAuditLogs` / the `auditLog.all` API) are stubs that return immediately and
yield an empty result. The `audit_log` database table exists in the schema, but
nothing is written to it, and there is **no UI surface** that displays audit
entries. Treat this page as a description of the intended model, not a feature
you can rely on today.
:::

## How it is meant to work

tRPC procedures across the app already call an `audit(...)` helper after
meaningful mutations. Each call captures:

- the acting user's id, email, and role,
- the active organization,
- an **action** (such as `create`, `update`, `delete`, `deploy`, `cancel`,
  `redeploy`, `restore`, `start`, `stop`, `reload`, `rebuild`, `move`, `login`,
  `logout`, `run`),
- a **resource type** (workspace, service, environment, deployment, user,
  custom role, domain, certificate, registry, runtime worker, SSH key, git
  provider, destination, notification, settings, and more),
- an optional resource id and human-readable name, and
- the timestamp.

Reading the audit log is gated behind the **auditLog: read** permission, so
when it is implemented only roles granted that permission would be able to query
it.

## What would be recorded

Because the `audit(...)` calls are sprinkled through the routers, a broad set of
actions already *intend* to be audited — deployments and their cancellation,
custom-role and member changes, settings changes (including toggling request
logs and editing the log-cleanup schedule), domain/certificate/registry/SSH-key
edits, and resource deletions, among others.

Coverage is **not uniform**, however. Some routers audit most mutations while
others audit few or none, so even once persistence is implemented, the audit
log would not be a complete record of every state change. Notably, the same
service router records some actions under the `service` resource type and others
under `application` for what is effectively the same resource, so filtering by
resource type would not cleanly group all events for a service.

:::note
If you need an authoritative change history today, do not rely on the in-app
audit log. Use your own controls — Git history for deploy sources, database
backups, and host-level logging — until audit persistence is implemented.
:::
