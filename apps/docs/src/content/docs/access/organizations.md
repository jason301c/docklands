---
title: Organizations
description: How organizations work in Docklands, who owns them, and how to create and switch between them.
---

An **organization** is the top-level tenant in Docklands. Every member, role,
workspace, runtime worker, registry, certificate, SSH key, notification, and
audit-log entry belongs to exactly one organization. When you sign in you have an
**active organization**, and everything you see and do in the dashboard is scoped
to it.

Docklands is single-tenant software you install on your own VM, so in practice
most installs use a single organization. The organization model still exists
(it is built on the Better Auth organization plugin) and you can create more than
one, but Docklands does not isolate organizations from each other the way a hosted
multi-tenant platform would: the person who operates the server is also the owner
of the organization, and host-level actions (Docker cleanup, ingress config,
server IP) are gated by the same owner/admin role rather than a separate
"instance operator" identity.

## The owner

Docklands signup is a **single-owner bootstrap**. The very first person to
register on a fresh install becomes the **owner**:

- Their account is created, the server records its public IP, and a default
  organization named "My Organization" is created with them as `ownerId`.
- They are inserted as a `member` with the `owner` role, and that membership is
  marked as their default.

After the first owner exists, open registration is closed. Every subsequent user
must be invited (see [Users & members](/access/users-and-members/)); attempting to
self-register a second account is rejected with "Admin is already created".

The owner role is special:

- It has **full access** to everything, including deleting the organization.
- It is **non-delegable and non-transferable**. You cannot invite someone as
  owner, you cannot change another member to or from owner, and you cannot change
  your own role.
- The owner cannot be deleted through the normal user-removal flow.

:::note
"Owner" here means owner of an organization. Because Docklands is single-tenant,
the organization owner is effectively the instance super-admin. Admins have the
same powers as the owner *except* deleting the organization.
:::

## Creating an organization

Only an **owner or admin** can create a new organization. From the dashboard,
creating one:

- inserts a new `organization` row with you as `ownerId`,
- adds you as a member of that organization with the `owner` role.

So you are always the owner of any organization you create, regardless of your
role in your current active organization.

:::caution
Creating extra organizations does not give you tenant isolation. Shared host
resources (the Docker daemon, ingress runtime, server IP) are global to the
machine and governed by whichever organization's owner/admin is acting. Treat
multiple organizations as a way to group projects and members, not as a security
boundary between untrusted parties.
:::

## Switching the active organization

Your **active organization** determines which members, workspaces, and resources
you see. Each membership can be marked as your **default**: when you create a
session (sign in), Docklands selects your default membership, falling back to your
most recently created membership if none is marked default.

You can mark a different organization as your default from the dashboard. This
unsets the default flag on all your other memberships and sets it on the chosen
one, so your next session lands there.

## Renaming and deleting

- **Rename** (update name/logo): only the owner of that organization can do it.
- **Delete**: only the owner can delete it, and Docklands refuses to delete your
  **last** organization where you are the owner — you must always own at least
  one. Deleting an organization cascades: members, invitations, roles, runtime
  workers, workspaces, and per-member resource grants tied to it are removed.

:::caution
Deletion is permanent and cascades to everything scoped to the organization.
There is no soft-delete or undo.
:::
