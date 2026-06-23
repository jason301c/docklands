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

- A Linux machine you are comfortable mutating (Docklands can initialize Docker
  Swarm, create networks, and bind common ports).
- Docker Engine.
- Node `>=24.4.0 <26` and Bun `>=1.3.14`.

See [Requirements](/install/requirements/) for the full list, including the ports
Docklands expects to use.

## Run it

```bash
bun install --frozen-lockfile
cp apps/docklands/.env.example apps/docklands/.env
NODE_ENV=development bun run setup
bun run dev
```

`bun run setup` initializes Swarm, the `docklands-network`, Traefik, and a local
Postgres, then waits for `DATABASE_URL` to accept a real connection before
running migrations.

:::tip[Light mode]
For UI or light backend work you don't need the full Docker setup — just a
reachable Postgres. Run `bun install`, copy the env file, then
`bun run migration:run` and `bun run dev`. Docker-heavy deployment flows won't be
representative in this mode.
:::

See [Configuration](/install/configuration/) for the environment variables the
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

The primary surface is the workspace canvas at `/dashboard/workspace` — the
project environment view for services, variables, deployments, domains, previews,
and topology. From there:

- Create your first [project and environment](/workspace/overview/).
- Deploy an [application](/applications/overview/), a
  [managed database](/databases/overview/), or a
  [template](/compose/templates/).
- Attach a [domain with HTTPS](/networking/domains/).
