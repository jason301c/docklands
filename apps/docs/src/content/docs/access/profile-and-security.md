---
title: Profile & account security
description: Manage your Docklands profile, password, two-factor authentication, API keys, and sessions.
---

Your account settings live at **Settings → Profile**
(`/dashboard/settings/profile`). Every signed-in user can manage their own
profile, password, and two-factor authentication regardless of role.

## Profile details

The **Account** card lets you edit your first name, last name, email, and avatar.
Avatars can be a generated initials badge, an uploaded image (max 2 MB, stored
inline), a solid color, a built-in avatar, or your Gravatar. Saving writes the
changes to your user record.

## Changing your password

Use the **Current Password** and **Password** fields on the Account card. To set
a new password you must enter your current one; Docklands verifies it against your
stored credential (bcrypt) before applying the change.

:::tip
Changing your password **signs out all your other sessions** — every session
except the one you used to make the change is revoked immediately. The device you
changed it on stays logged in.
:::

If you ever lose access entirely, the install ships server-side recovery
entrypoints an operator can run on the host (reset password, reset 2FA). Those are
host commands, not dashboard actions.

## Two-factor authentication (2FA)

2FA is **TOTP-based** (authenticator apps such as Google Authenticator, 1Password,
Aegis). Enabling and managing it is self-service from the Account card.

### Enabling 2FA

1. Click **Enable 2FA** and enter your password to start setup. You can optionally
   set a custom **issuer** label.
2. Scan the QR code (or copy the secret) into your authenticator app.
3. Save the **backup codes** shown — download or copy them. Each code works once
   and lets you sign in if you lose your device.
4. Enter the 6-digit code from your app to confirm. 2FA is now active.

### Signing in with 2FA

After enabling 2FA, signing in with email and password prompts for your TOTP
code. You can instead use a one-time **backup code** if you can't reach your
authenticator.

:::caution
2FA is **opt-in per user**. Docklands does not currently let an admin require 2FA
across the organization, and 2FA does not gate sensitive in-app actions on its
own — it protects the login. Treat enabling 2FA for every member (especially the
owner and admins) as an operational policy you enforce yourselves.
:::

### Managing or disabling 2FA

Once enabled, the button becomes **Manage 2FA**. After re-entering your password
you can:

- **Regenerate backup codes** — invalidates the old set and issues a fresh one.
- **Disable 2FA** — turns off two-factor for your account after a confirmation
  prompt. Your account is less protected afterward.

## API & CLI keys

If your role grants the **`api:read`** capability (owner, admin, or a custom role
that includes it), an **API/CLI Keys** panel appears on your profile. Keys
authenticate programmatic access to the Docklands API/CLI by sending them in the
`x-api-key` request header.

Generate a key with **Generate New Key**. You can set:

- a **name** and optional **prefix**,
- an **expiration** (never, or 1 day up to 1 year),
- **rate limiting** (max requests per time window),
- **request limiting** (a total request budget with optional refill),
- the **organization** the key acts in.

The key is shown **once** at creation — copy it immediately, because Docklands
stores only a hash and cannot display it again. Keys are listed with their name,
prefix, creation date, and expiry; delete one with the trash icon.

:::caution
API keys carry the **full identity and role of the user who created them** —
there is no narrower per-key permission scope. A key minted by an owner or admin
can do anything that user can do, including host and infrastructure actions, via
the same permission checks as the dashboard. The organization a key acts in comes
from the key's metadata, resolved to your membership in that organization. Treat
every key as a password equivalent: scope expiry/rate limits tightly, store keys
in a secret manager, and delete keys you no longer use. Deleting a user also
deletes all of their API keys.
:::

## Sessions

Sessions are cookie-based. Key behaviors:

- Sessions **expire after 3 days** and refresh as you stay active (the expiry
  rolls forward roughly once a day of use).
- Sign-in and sign-out are recorded in the organization **audit log**.
- Changing your password revokes all other sessions (see above).
- On a typical LAN/IP self-hosted install, auth cookies are **not** forced to
  `Secure`, so Docklands works over plain HTTP. If you put Docklands behind HTTPS
  with a real domain, prefer terminating TLS at the ingress and configuring the
  install's host/trusted origins so links and cookies resolve correctly.

:::note
Because the active organization is stored on your session, switching your default
organization takes effect on your **next** sign-in (or new session), not
retroactively on the current one.
:::
