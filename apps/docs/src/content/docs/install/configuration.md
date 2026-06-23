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
| `DATABASE_URL` | — | PostgreSQL connection string. **Required.** |
| `POSTGRES_PASSWORD_FILE` | — | Alternative to embedding the password in `DATABASE_URL`; reads the password from a secret file. |
| `BETTER_AUTH_SECRET` | — | Signing secret for auth/sessions. **Set in production.** `bun run setup` generates one for local installs. |
| `BETTER_AUTH_SECRET_FILE` | — | Read `BETTER_AUTH_SECRET` from a file (secret mounts). |
| `BETTER_AUTH_URL` | derived | Stable external URL of this instance (e.g. `https://docklands.example.com`), used for absolute auth callback/verification links. Leave unset to derive the origin from each request. Defaults to `http://localhost:${PORT}` in dev. |
| `PORT` | `3000` | Port the dashboard/API listens on. |
| `HOST` | — | Bind host for the server. |
| `NODE_ENV` | — | `development` or `production`. Affects on-disk paths (`/etc/docklands` vs `.docker/`) and whether the Let's Encrypt resolver is configured. |

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

Used to send account verification / auth emails. (Deployment **notifications**
are configured separately per provider — see
[Notifications](/settings/notifications/).)

| Variable | Purpose |
|---|---|
| `SMTP_SERVER` | SMTP host. |
| `SMTP_PORT` | SMTP port. |
| `SMTP_USERNAME` | SMTP username. |
| `SMTP_PASSWORD` | SMTP password. |
| `SMTP_FROM_ADDRESS` | From address for outbound mail. |

## Advanced

| Variable | Purpose |
|---|---|
| `DOCKLANDS_TEMPLATES_DIR` | Override the directory the [template catalog](/compose/templates/) is loaded from. |
| `POSTGRES_WAIT_TIMEOUT` | How long startup waits for Postgres to accept connections. |
| `POSTGRES_WAIT_RETRY` | Retry interval while waiting for Postgres. |
| `RELEASE_TAG`, `DOCKLANDS_IMAGE`, `DOCKLANDS_DOCKER_HUB_TAGS_URL` | Version/update metadata shown in the dashboard. |

:::tip
`bun run setup` generates `BETTER_AUTH_SECRET` for you on local installs and
waits for `DATABASE_URL` to accept a real connection before running migrations.
If it reports that the `docklands` role/database doesn't exist, another Postgres
is probably already on port `5432` — stop it or change `DATABASE_URL`.
:::
