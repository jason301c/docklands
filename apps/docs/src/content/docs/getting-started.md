---
title: Getting Started
description: Run the Docklands control plane from source on your own machine.
---

Docklands is a self-hosted deployment control plane you run on your own machine.
It assumes customer-owned infrastructure: Docker Engine, the VM filesystem,
ports, secrets, and domains all live on hardware you control. If you're new here,
read [What is Docklands?](/concepts/what-is-docklands/) first.

This page is the fastest path to a running instance **from source** — the common
workflow while Docklands is pre-release. To run the built container on a server
instead, see [Production install](/install/production/).

## Requirements

- Node `>=24.4.0 <26` and Bun `>=1.3.14`.
- Docker (used to start a throwaway local Postgres), or any reachable PostgreSQL.

See [Requirements](/install/requirements/) for the full list, including the ports
Docklands expects to use.

## Local mode — the fast loop

This is the everyday path for working on the UI and backend.

```bash
bun install --frozen-lockfile
cp apps/docklands/.env.example apps/docklands/.env
bun run dev
```

`bun run dev` is one self-healing command: it generates local dev secrets,
ensures a local Postgres (a throwaway `docklands-dev-postgres` container, unless
`DATABASE_URL` already points at a running database), applies migrations, and
starts the control plane on `http://localhost:3000`.

Local mode deliberately does **not** initialize Docker Swarm, Traefik, or
`/etc/docklands` — so it stays fast and safe, but deploy and ingress flows are
not exercised here. For those, use a replica.

## Replica mode — a faithful server

To work on anything that touches real infrastructure (deploys, ingress, Swarm,
backups, remote workers), run a **replica**: a disposable Linux VM that mirrors a
real self-hosted install. You edit it from your machine over SSH and browse it in
your own browser via forwarded ports.

```bash
bun run replica:up     # boot the VM (needs Lima: `brew install lima`)
bun run replica:ssh    # shell in; then: cd /workspace && bun install && bun run dev
```

To run the built container on a server instead, see
[Production install](/install/production/). See
[Configuration](/install/configuration/) for the environment variables the
control plane reads.

## Useful checks

```bash
bun run typecheck
bun run test:ci
bun run build
```

## First run

Open the dashboard (default `http://localhost:3000`). The first account you
create becomes the organization **owner**.

Start at **Setup** (top of the sidebar). It walks you through the one-time choices
to get online: how the public reaches your apps (a
[Cloudflare Tunnel](/networking/cloudflare-tunnels/) is the easiest — no ports,
DNS, or certificates — or a public IP), connecting a
[Git provider](/git/overview/), and deploying your first app.

The primary surface is the workspace canvas at `/dashboard/workspace` — the
project environment view for services, variables, deployments, domains, previews,
and topology. From there:

- Create your first [project and environment](/workspace/overview/).
- Deploy an [application](/applications/overview/), a
  [managed database](/databases/overview/), or a
  [template](/compose/templates/).
- Attach a [domain](/networking/domains/) — over a Cloudflare Tunnel or with
  [HTTPS on a public IP](/networking/tls-certificates/).
