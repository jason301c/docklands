---
title: Profile & account security
description: Manage your Docklands profile, password, passkeys, API keys, and sessions.
---

Your account settings live at **Settings -> Profile**
(`/dashboard/settings/profile`). Every signed-in user can manage their own
profile, password, passkeys, API keys, and sessions regardless of role.

## Profile details

The **Account** card lets you edit your first name, last name, email, and avatar.
Avatars can be a generated initials badge, an uploaded image (max 2 MB, stored
inline), a solid color, a built-in avatar, or your Gravatar. Saving writes the
changes to your user record.

## Changing your password

Use the **Current Password** and **Password** fields on the Account card. To set
a new password you must enter your current one; Docklands verifies it against your
stored credential before applying the change.

:::tip
Changing your password **signs out all your other sessions**. The device you
changed it on stays logged in.
:::

If you lose access entirely, an operator with host access can run the
server-side password reset entrypoint. See [Operations](/install/operations/).

## Passkeys

Docklands supports **passkeys** for passwordless sign-in. Passkeys are WebAuthn
credentials stored by your browser, operating system, password manager, or
hardware security key.

### Adding a passkey

1. Open the **Passkeys** section on your profile.
2. Click **Add passkey**.
3. Give it a recognizable name, such as "MacBook Touch ID" or "YubiKey".
4. Follow your browser or device prompt to complete registration.

After registration, the passkey appears in your profile list and can be used from
the sign-in screen with **Sign in with a passkey**.

### Managing passkeys

The Passkeys list shows the credentials registered to your account. You can
remove a passkey from the list when you no longer use that device or security
key.

:::caution
Keep more than one recovery path. If you rely on passkeys, register at least two
credentials or keep password access available. If you lose your only passkey,
recover the account with the owner password reset entrypoint and then register a
new passkey.
:::

## API & CLI keys

If your role grants the **`api:read`** capability (owner, admin, or a custom role
that includes it), an **API/CLI Keys** panel appears on your profile. Keys
authenticate programmatic access to the Docklands API/CLI by sending them in the
`x-api-key` request header.

Generate a key with **Generate New Key**. You can set:

- a **name** and optional **prefix**,
- an **expiration** (never, or 1 day up to 1 year),
- **rate limiting** (max requests per time window),
- **request limiting** (a total request budget with optional refill).

The key is shown **once** at creation. Copy it immediately, because Docklands
stores only a hash and cannot display it again. Keys are listed with their name,
prefix, creation date, and expiry; delete one with the trash icon.

:::caution
API keys carry the **full identity and role of the user who created them**. A key
minted by an owner or admin can do anything that user can do, including host and
infrastructure actions, via the same permission checks as the dashboard. Treat
every key as a password equivalent: scope expiry/rate limits tightly, store keys
in a secret manager, and delete keys you no longer use. Deleting a user also
deletes all of their API keys.
:::

## Sessions

Sessions are cookie-based. Key behaviors:

- Sessions **expire after 3 days** and refresh as you stay active.
- Sign-in and sign-out are intended audit events, but audit persistence is not
  complete yet. See [Audit log](/observability/audit-log/).
- Changing your password revokes all other sessions.
- On a typical LAN/IP self-hosted install, auth cookies are **not** forced to
  `Secure`, so Docklands works over plain HTTP. If you put Docklands behind HTTPS
  with a real domain, prefer terminating TLS at the ingress and configuring the
  install's host/trusted origins so links and cookies resolve correctly.

:::note
Docklands has one instance organization. The active organization is set from
that membership when your session is created.
:::
