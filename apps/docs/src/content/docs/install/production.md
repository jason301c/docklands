---
title: Production install
description: Build and run the Docklands control plane as a container on your server.
---

:::caution[Pre-release]
Docklands has not had a tagged release. CI publishes the image on every `canary`
push (`jason301c/docklands:canary`) and will publish `:latest` plus a version tag
at the first release. Until then, point the installer at the canary image or build
from source. Treat production installs as advanced, run them somewhere you're
comfortable rebuilding, and expect no upgrade guarantees yet.
:::

## Quick install (one command)

On a fresh Linux server, run as root:

```bash
curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh | sudo sh
```

This installs Docker if missing, generates and persists secrets to
`/etc/docklands`, initializes Swarm, the `docklands-network` overlay, Traefik, and
bundled Postgres (through the image's `setup-instance` entrypoint), starts the
dashboard, and prints the URL. Upgrade in place later by re-running it with the
`update` argument:

```bash
curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh | sudo sh -s -- update
```

Until the first tagged release publishes `:latest`, install the canary image:

```bash
curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh \
  | sudo DOCKLANDS_IMAGE=jason301c/docklands:canary sh
```

### On a Mac (e.g. a Mac mini)

The Docklands server is Linux, so on macOS the **same command** boots a
[Lima](https://lima-vm.io) VM and runs the install inside it (installing Lima via
Homebrew if it is missing):

```bash
curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh | sh
```

The dashboard is forwarded to `http://localhost:3000`. For public app domains
without opening any ports, use the Cloudflare Tunnel ingress mode (the
beginner-first default). The VM is arm64, so it is not bit-identical to an amd64
cloud server.

## Manual install (advanced)

The steps below are what the one-command installer wraps. Use them when you want
explicit control over the image, database, and secrets.

## 1. Choose or build the image

After v0.1.0 is published, use the release image:

```bash
export DOCKLANDS_IMAGE=jason301c/docklands:0.1.0
docker pull "$DOCKLANDS_IMAGE"
```

From an unreleased source checkout, build a single-architecture image into the
local Docker daemon and use that tag in the commands below:

```bash
docker build --pull -t docklands:local -f apps/docklands/Dockerfile .
export DOCKLANDS_IMAGE=docklands:local
```

`bun run release:image` is the multi-platform release-build helper. It verifies
the production Dockerfile and tags `jason301c/docklands:<package-version>`, but
it does not load a runnable image into the local Docker daemon. Use the
`docker build` command above when you need a local image for `docker run`.

The image is a `node:24.4.0-slim` base with Bun available for package-manager
subcommands; the app itself runs on Node.

## 2. Provide a database and secrets

Docklands needs:

- **`DATABASE_URL`** — a reachable PostgreSQL instance. The setup entrypoint
  (`dist/setup-instance.mjs`, run once) can provision a `docklands-postgres`
  service for you; otherwise point this at your own Postgres. Whole-instance Docklands backup/restore currently supports
  only the bundled `docklands-postgres` service; if you use an external
  PostgreSQL provider, use that provider's backup/restore tooling for the
  database and back up `/etc/docklands` plus `DOCKLANDS_ENCRYPTION_KEY`
  separately. Use either `DATABASE_URL` or `POSTGRES_PASSWORD_FILE`, not both.
- **`POSTGRES_PASSWORD_FILE`** — an alternative to embedding the database
  password in `DATABASE_URL`. With this mode Docklands builds the connection
  string from `POSTGRES_USER` (`docklands`), `POSTGRES_DB` (`docklands`),
  `POSTGRES_HOST` (`docklands-postgres`), `POSTGRES_PORT` (`5432`), and the
  secret-file contents. Setup can provision bundled Postgres from these values.
  For an external database, set the host/user/database/port values explicitly.
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
  "$DOCKLANDS_IMAGE" \
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
  "$DOCKLANDS_IMAGE"
```

The image entrypoint waits for Postgres, validates secrets, runs database
migrations, and then boots the server:

```text
bun run wait-for-postgres && exec bun run start
```

`bun run start` runs `dist/check-secrets.mjs`, `dist/migrate-db.mjs`, and
`dist/server.mjs` in order, so migrations are applied automatically on every
start — no separate migration step is required for a normal boot.

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
