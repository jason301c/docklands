---
title: Production install
description: Build and run the Docklands control plane as a container on your server.
---

:::caution[Pre-release]
Docklands has not had a tagged release, and there is **no one-line installer or
published image yet**. The supported path today is to build the image from this
repository and run it yourself. Treat production installs as advanced, and run
them somewhere you're comfortable rebuilding. Expect no upgrade guarantees.
:::

For a from-source workflow (the common path while Docklands is pre-release), see
[Local development](/getting-started/). This page covers running the built
container on a server.

## 1. Build the image

From a checkout of the repository on a machine with Docker and Bun:

```bash
bun run docker:build
```

This builds `apps/docklands/Dockerfile` with the workspace as the build context
and tags the image from `apps/docklands/package.json` (image name `docklands`).
The image is a `node:24.4.0-slim` base with Bun available for installs; the app
runs on Node.

## 2. Provide a database and secrets

Docklands needs:

- **`DATABASE_URL`** — a reachable PostgreSQL instance. `bun run setup` can
  provision a `docklands-postgres` Swarm service for you; otherwise point this at
  your own Postgres. Whole-instance Docklands backup/restore currently supports
  only the bundled `docklands-postgres` service; if you use an external
  PostgreSQL provider, use that provider's backup/restore tooling for the
  database and back up `/etc/docklands` plus `DOCKLANDS_ENCRYPTION_KEY`
  separately. Use either `DATABASE_URL` or `POSTGRES_PASSWORD_FILE`, not both.
- **`BETTER_AUTH_SECRET`** (or `BETTER_AUTH_SECRET_FILE`) — the auth signing
  secret. **Set this explicitly in production.** For local installs `bun run
  setup` generates one; production should manage it as a secret. Use either the
  env var or the file variant, not both.
- **`DOCKLANDS_ENCRYPTION_KEY`** (or `DOCKLANDS_ENCRYPTION_KEY_FILE`) — the key
  that encrypts [secrets at rest](/install/configuration/#secrets-at-rest)
  (provider tokens, registry/SMTP passwords, S3 credentials, database config,
  env values). A base64-encoded 32-byte key, **separate** from
  `BETTER_AUTH_SECRET`. **Set this explicitly in production** and back it up —
  losing it makes encrypted values unrecoverable. Generate with `openssl rand
  -base64 32`. Use either the env var or the file variant, not both.

On production start, Docklands validates these before migrations run. Secret
files must be readable and non-empty, the encryption key must decode to 32 bytes,
and ambiguous env/file pairs stop startup with an operator-facing error.

See [Configuration](/install/configuration/) for the full variable reference.

## 3. Initialize host runtime

Run setup once from the built image before starting the dashboard. This
initializes Docker Swarm, creates the shared `docklands-network`, writes the
Traefik config under `/etc/docklands`, and starts the host-level
`docklands-traefik` container that owns ports `80` and `443`.

```bash
docker run --rm --name docklands-setup \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/docklands:/etc/docklands \
  -e DATABASE_URL="postgres://user:pass@host:5432/docklands" \
  -e BETTER_AUTH_SECRET="<a long random secret>" \
  -e DOCKLANDS_ENCRYPTION_KEY="<openssl rand -base64 32>" \
  -e SKIP_BUNDLED_POSTGRES=true \
  docklands \
  node -r dotenv/config dist/setup-instance.mjs
```

Use `SKIP_BUNDLED_POSTGRES=true` when `DATABASE_URL` points at an external
database. If you intentionally want setup to provision the bundled
`docklands-postgres` Swarm service, set `DATABASE_URL` to the bundled database
credentials instead and omit the skip flag. In either case, `DATABASE_URL` must
use an address that the Docklands container can reach; if Postgres is bound only
to the Docker host, use a host address or Docker host alias that is reachable
from containers rather than `localhost`.

:::note[Ingress ports]
Do not publish `80` or `443` on the Docklands dashboard container itself.
Traefik runs as a separate host container and binds those ports directly. If
another service already owns them, setup will fail until you free the ports or
configure alternate Traefik ports.
:::

## 4. Run the container

The control plane manages Docker on the host, so it needs access to the Docker
socket (or a daemon via `DOCKLANDS_DOCKER_HOST` / `DOCKER_HOST`) and the same
persistent `/etc/docklands` that setup initialized:

```bash
docker run -d --name docklands \
  --network docklands-network \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/docklands:/etc/docklands \
  -e DATABASE_URL="postgres://user:pass@host:5432/docklands" \
  -e BETTER_AUTH_SECRET="<a long random secret>" \
  -e DOCKLANDS_ENCRYPTION_KEY="<openssl rand -base64 32>" \
  docklands
```

The container's start command runs database migrations and then boots the
server:

```text
node dist/migrate-db.mjs && node dist/server.mjs
```

So migrations are applied automatically on every start — no separate migration
step is required for a normal boot.

:::note[Mounting the Docker socket]
Giving a container access to `/var/run/docker.sock` grants control over the host
Docker daemon. That is inherent to what a deployment control plane does — only
run Docklands on hosts where that trust is acceptable.
:::

## 5. First run

Open `http://<host>:3000`. The first account you create becomes the
organization **owner**. From there, set up an
[ingress domain and Let's Encrypt email](/networking/ingress/) so the dashboard
and your services can be served over HTTPS on real domains.

If you lock yourself out, see [Operations](/install/operations/) for resetting
the owner password and re-registering passkeys.
