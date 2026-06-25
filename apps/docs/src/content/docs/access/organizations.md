---
title: Instance organization
description: How Docklands' single organization works, who owns it, and how members are scoped.
---

Docklands is single-tenant software you install on your own VM. Each install has
exactly one **instance organization**. Every member, role, workspace, runtime
worker, registry, certificate, SSH key, notification, and audit-log entry belongs
to that organization.

The organization model exists because Docklands uses Better Auth's organization
plugin internally, but this is **not** hosted multi-tenancy:

- users cannot create additional organizations;
- users cannot switch between organizations;
- organization create/update/delete API paths are disabled;
- host-level actions still affect the one VM or cluster that Docklands controls.

Think of the organization as the access-control boundary for the instance, not as
a separate customer tenant.

## The owner

Docklands signup is a **single-owner bootstrap**. The very first person to
register on a fresh install becomes the **owner**:

- their account is created;
- the server records its public IP;
- the instance organization is created;
- they are inserted as a `member` with the `owner` role.

After the first owner exists, open registration is closed. Every subsequent user
must be invited. See [Users & members](/access/users-and-members/).

The owner role is special:

- it has full access to everything on the instance;
- it is non-delegable and non-transferable;
- you cannot invite someone as owner;
- you cannot change another member to or from owner;
- the owner cannot be deleted through the normal user-removal flow.

:::note
Because Docklands is single-tenant, the organization owner is effectively the
instance super-admin. Admins have nearly the same operational powers, but the
owner role remains sealed.
:::

## Members and roles

Every non-owner user is a member of the instance organization. Members receive
one role:

- **admin** — can manage users, roles, and host/infrastructure settings.
- **member** — read-only by default and sees only explicitly granted resources.
- **custom role** — a named role with selected capabilities.

Resource access is separate from role capability. A member may have a role that
allows a service action, but they still need access to the relevant workspace,
environment, service, git provider, or runtime worker before it appears in the
dashboard.

## Naming the organization

The instance organization supplies the name/logo shown around the dashboard and
used by membership checks. Treat that metadata as instance identity. It is not a
way to create isolated tenants or split the Docker host into security domains.

## What this means operationally

- Run one Docklands instance per trust boundary.
- Do not put mutually untrusted teams in the same install and expect
  organization separation to isolate them.
- Owners and admins can affect host-level resources such as Docker cleanup,
  ingress files, runtime workers, storage destinations, registries, and
  certificates.
- To separate teams with different infrastructure trust boundaries, use separate
  VMs and separate Docklands installs.
