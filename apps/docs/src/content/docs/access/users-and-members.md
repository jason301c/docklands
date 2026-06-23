---
title: Users & members
description: Invite people into your organization, assign their role, and remove members in Docklands.
---

After the first owner bootstraps the install, every other person joins by
**invitation**. A user is a global account (email + password, optional 2FA); a
**member** is that user's membership in one organization, carrying their **role**
in that organization. Manage members from **Settings → Users**
(`/dashboard/settings/users`).

To open the Users page you need the `member:read` capability; owner, admin, and
any custom role granting `member:read` qualify. Inviting, changing roles, and
removing members each require their own capability (below), so a custom role can
be given exactly the slice of user management you want.

## Two ways to add a member

The **Add Invitation** dialog offers two methods:

### Invitation link

Creates a pending `invitation` row for the email and chosen role, valid for
**48 hours**. You can optionally send it through a configured email provider, or
copy the link and deliver it yourself. The invitee opens
`/invitation?token=<id>` and:

- **New user** — fills in name and password to create their account. Signup is
  bound to the invitation token (`x-docklands-token`): the email must match the
  invitation, the invitation must still be pending and unexpired, or account
  creation is rejected. On success they accept the invitation and become a member
  with the invited role.
- **Existing user** — is told to sign in instead, then accept the invitation from
  their account.

### Initial credentials

Creates the user **directly** with an email, a starting password (minimum 8
characters), and a role — no email round-trip. The person can sign in
immediately. Any pending invitation for that email is canceled. This is handy for
air-gapped installs with no email provider configured.

Both methods require the **`member:create`** capability (also exposed in
access-control as `invitation:create`). You cannot invite or create a user with
the **owner** role through either path.

:::note
Invitations expire after 48 hours. If a link has expired, remove the stale
invitation and send a new one. Pending and expired invitations are listed on the
Users page and can be revoked (`member:create` is required to manage them).
:::

## Roles

Every member has a role. Three roles are built in:

- **owner** — full access, including deleting the organization. Exactly one
  owner; the role is non-transferable.
- **admin** — same as owner except cannot delete the organization. Can manage
  users, roles, and host/infrastructure settings.
- **member** — read-only by default. Members can see only the workspaces,
  environments, and services they have been explicitly granted, and act within
  them; they cannot manage org-level resources.

You can also define **custom roles** with a precise set of capabilities. See
[Roles & permissions](/access/roles-and-permissions/) for the full model. The
invite and change-role dialogs let you pick `admin`, `member`, or any custom role
(never `owner`).

## Changing a member's role

Open a member's actions menu and choose **Change Role**. Changing a role requires
the **`member:update`** capability and follows a strict hierarchy:

- You **cannot change your own role**.
- The **owner role is sealed**: you cannot change anyone *to* owner or change the
  owner *away* from owner.
- An **admin can only change members** (and custom-role holders), not other
  admins. Only the **owner can change an admin's role**.
- Assigning a custom role checks that the role actually exists in the
  organization first.

Role changes are written to the audit log with the before/after role.

## Removing a member

Choose **Delete User** from the member's actions menu. Removal requires you to be
**owner or admin** and enforces:

- You cannot remove the **owner**.
- An **admin cannot remove themselves**, and an admin cannot remove **another
  admin** — only the owner can remove admins.
- Admins can remove members and custom-role holders.

:::caution
On this self-hosted build, "Delete User" deletes the **entire user account**, not
just their membership in the current organization. Because the user row cascades,
this also removes their sessions, API keys, 2FA, account credentials, and any
memberships they held in *other* organizations on this install. There is no
"remove from this organization only" option. Use it deliberately.
:::

## What members can actually see

Assigning the `member` role (or a limited custom role) is only half of access
control. By default a member sees **nothing** until you grant them specific
workspaces, environments, and services through **Add Permissions** on the Users
page. Capabilities (what they may *do*) come from the role; resource access
(what they may *see*) comes from the per-member grants. Both are covered in
[Roles & permissions](/access/roles-and-permissions/).
