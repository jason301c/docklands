---
title: Application Security (Basic Auth)
description: Protect an application with HTTP basic authentication at the ingress edge.
---

The **Security** panel adds HTTP **basic authentication** in front of your
application, enforced at the ingress runtime before requests reach your container.
It is a quick way to gate a staging app, an internal tool, or anything that should
not be open to the public — without adding auth code to the app itself.

You manage it under **Advanced → Security** ("Add basic auth to your application").

## Adding a credential

Each security rule is a username/password pair:

- **Username** — the login name.
- **Password** — the password (shown masked in the UI, with a reveal toggle).

You can add several credentials to one application; each is a separate valid login.
A username must be unique within a single application.

Once a credential exists, the ingress runtime challenges visitors with a basic-auth
prompt and only forwards requests that present valid credentials.

## Editing and removing

You can edit a credential's username or password, or delete it. Deleting the last
credential removes the basic-auth challenge and the application becomes openly
reachable again (subject to its [domains](/applications/domains/) and
[ports](/applications/ports/)).

:::caution
Basic auth sends credentials on every request. Always pair it with HTTPS (a domain
with TLS enabled) so the credentials are not sent in clear text. It is a coarse
gate suitable for protecting non-sensitive or internal surfaces — it is not a
substitute for real application-level authentication and authorization for
sensitive data.
:::

:::note
Basic auth protects HTTP/HTTPS traffic that arrives through a domain. It does not
protect a raw [published port](/applications/ports/) — a TCP/UDP port you publish
directly bypasses the ingress edge.
:::
