---
title: Getting Started
description: Install and run the Docklands control plane on your own VM.
---

Docklands is a self-hosted deployment control plane you run on your own machine.
It assumes customer-owned infrastructure: Docker Engine, the VM filesystem,
ports, secrets, and domains all live on hardware you control.

## Requirements

- A Linux VM you are comfortable mutating (Docklands can initialize Docker
  Swarm, create networks, and bind common ports).
- Docker Engine.
- Node `>=24.4.0 <26` and Bun `>=1.3.14` for local development.

## Local development

```bash
bun install --frozen-lockfile
cp apps/docklands/.env.example apps/docklands/.env
NODE_ENV=development bun run setup
bun run dev
```

`bun run setup` waits for the configured `DATABASE_URL` to accept a real
connection before running migrations.

## Useful checks

```bash
bun run typecheck
bun run test:ci
bun run build
```

## Next steps

Point your browser at the workspace canvas at `/dashboard/workspace` — the
project environment surface for services, variables, deployments, domains,
previews, and topology.
