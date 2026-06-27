---
title: Configuration
description: Environment variables the Docklands control plane reads.
---

Docklands is configured with environment variables. In development they come
from `apps/docklands/.env` (copied from `.env.example`); in production pass them
to the container. This page lists the variables the control plane actually reads.

## Core

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string. Use either this or `POSTGRES_PASSWORD_FILE`, not both. |
| `POSTGRES_PASSWORD_FILE` | — | Alternative to embedding the password in `DATABASE_URL`; reads the password from a secret file and combines it with `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_HOST`, and `POSTGRES_PORT`. Use either this or `DATABASE_URL`, not both. |
| `POSTGRES_USER` | `docklands` | Database user used when `POSTGRES_PASSWORD_FILE` is set. Also used when setup provisions bundled Postgres from a password file. |
| `POSTGRES_DB` | `docklands` | Database name used when `POSTGRES_PASSWORD_FILE` is set. Also used when setup provisions bundled Postgres from a password file. |
| `POSTGRES_HOST` | `docklands-postgres` | Database host used when `POSTGRES_PASSWORD_FILE` is set. |
| `POSTGRES_PORT` | `5432` | Database port used when `POSTGRES_PASSWORD_FILE` is set. |
| `BETTER_AUTH_SECRET` | — | Signing secret for auth/sessions. **Set in production.** `bun run dev` generates one for local installs. Use either this or `BETTER_AUTH_SECRET_FILE`, not both. |
| `BETTER_AUTH_SECRET_FILE` | — | Read `BETTER_AUTH_SECRET` from a file (secret mounts). Use either this or `BETTER_AUTH_SECRET`, not both. |
| `DOCKLANDS_ENCRYPTION_KEY` | — | Key for [secrets at rest](#secrets-at-rest). Base64-encoded 32 bytes, **separate** from `BETTER_AUTH_SECRET`. **Set in production.** `bun run dev` generates one for local installs. Use either this or `DOCKLANDS_ENCRYPTION_KEY_FILE`, not both. |
| `DOCKLANDS_ENCRYPTION_KEY_FILE` | — | Read `DOCKLANDS_ENCRYPTION_KEY` from a file (secret mounts). Use either this or `DOCKLANDS_ENCRYPTION_KEY`, not both. |
| `BETTER_AUTH_URL` | derived | Stable external URL of this instance (e.g. `https://docklands.example.com`), used for absolute auth callback/verification links. Leave unset to derive the origin from each request. Defaults to `http://localhost:${PORT}` in dev. |
| `PORT` | `3000` | Port the dashboard/API listens on. |
| `HOST` | — | Bind host for the server. |
| `NODE_ENV` | — | `development` or `production`. Affects on-disk paths (`/etc/docklands` vs `.docker/`) and whether the Let's Encrypt resolver is configured. |

Production startup validates this core configuration before migrations run. Any
`*_FILE` path must be readable and non-empty, `DOCKLANDS_ENCRYPTION_KEY` must
decode to 32 bytes, `DATABASE_URL` must be a valid Postgres URL, and the env/file
pairs above must not be set at the same time.

## Docker connection

By default Docklands auto-detects the local Docker socket. Override when the
daemon is elsewhere:

| Variable | Purpose |
|---|---|
| `DOCKLANDS_DOCKER_HOST` | Connect to a remote Docker host instead of the local socket. |
| `DOCKLANDS_DOCKER_PORT` | Port for the remote Docker host. |
| `DOCKLANDS_DOCKER_API_VERSION` | Pin the Docker Engine API version. |
| `DOCKER_HOST` | Standard Docker socket/host override (used if the Docklands-specific vars are unset). |

## Ingress (Traefik)

| Variable | Purpose |
|---|---|
| `TRAEFIK_VERSION` | Traefik image version to run. |
| `TRAEFIK_PORT` | HTTP entrypoint port (default ingress maps `80`). |
| `TRAEFIK_SSL_PORT` | HTTPS entrypoint port (default ingress maps `443`). |
| `TRAEFIK_HTTP3_PORT` | HTTP/3 entrypoint port. |

See [Ingress](/networking/ingress/) for how these map to the running Traefik
service.

## Email (auth verification)

Docklands does not read SMTP environment variables for system email. Password
reset, verification, and invitation email use the Email or Resend notification
providers configured in **Settings → Notifications**. Until a provider is
configured, email-dependent auth flows show an operator-facing unavailable state
instead of silently dropping mail. See [Notifications](/settings/notifications/).

## Advanced

| Variable | Purpose |
|---|---|
| `DOCKLANDS_TEMPLATES_DIR` | Override the directory the [template catalog](/compose/templates/) is loaded from. |
| `POSTGRES_WAIT_TIMEOUT` | How long startup waits for Postgres to accept connections. |
| `POSTGRES_WAIT_RETRY` | Retry interval while waiting for Postgres. |
| `RELEASE_TAG`, `DOCKLANDS_IMAGE`, `DOCKLANDS_DOCKER_HUB_TAGS_URL` | Version/update metadata shown in the dashboard. |

## Secrets at rest

Docklands encrypts secret material in the database with AES-256-GCM before it is
stored: SSH private keys, Git provider tokens and OAuth secrets, registry and
SMTP passwords, notification webhook URLs/tokens, S3 backup credentials, TLS
private keys, managed-database credentials, and service environment variables.
This means a database dump or a copy of `/etc/docklands` does not expose those
secrets in the clear.

The key comes from `DOCKLANDS_ENCRYPTION_KEY` (or `DOCKLANDS_ENCRYPTION_KEY_FILE`)
and is **deliberately separate** from `BETTER_AUTH_SECRET`, so rotating the
auth-signing secret does not force a re-encrypt of your data.

- **Local installs:** `bun run dev` generates the key into `.env`.
- **Production:** set `DOCKLANDS_ENCRYPTION_KEY` (or point
  `DOCKLANDS_ENCRYPTION_KEY_FILE` at a mounted secret). Generate one with:

  ```bash
  openssl rand -base64 32
  ```

:::danger[Back up the key]
The encryption key is required to read every encrypted secret. **If you lose it,
those values are unrecoverable** and must be re-entered. Keep it backed up
alongside (but not inside) your database backups, and treat it as a top-level
secret.
:::

:::tip
`bun run dev` generates `BETTER_AUTH_SECRET` and `DOCKLANDS_ENCRYPTION_KEY` for
you on local installs and waits for `DATABASE_URL` to accept a real connection
before running migrations. If it reports that the `docklands` role/database
doesn't exist, another Postgres is probably already on port `5432` — stop it or
change `DATABASE_URL`.
:::
