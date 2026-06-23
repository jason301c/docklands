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
  your own Postgres.
- **`BETTER_AUTH_SECRET`** (or `BETTER_AUTH_SECRET_FILE`) — the auth signing
  secret. **Set this explicitly in production.** For local installs `bun run
  setup` generates one; production should manage it as a secret.

See [Configuration](/install/configuration/) for the full variable reference.

## 3. Run the container

The control plane manages Docker on the host, so it needs access to the Docker
socket (or a daemon via `DOCKLANDS_DOCKER_HOST` / `DOCKER_HOST`), the ingress
ports, and a persistent `/etc/docklands`:

```bash
docker run -d --name docklands \
  -p 3000:3000 -p 80:80 -p 443:443 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/docklands:/etc/docklands \
  -e DATABASE_URL="postgres://user:pass@host:5432/docklands" \
  -e BETTER_AUTH_SECRET="<a long random secret>" \
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

## 4. First run

Open `http://<host>:3000`. The first account you create becomes the
organization **owner**. From there, set up an
[ingress domain and Let's Encrypt email](/networking/ingress/) so the dashboard
and your services can be served over HTTPS on real domains.

If you lock yourself out, see [Operations](/install/operations/) for resetting
the owner password and two-factor.
