---
title: Architecture
description: How the Docklands control plane runs — runtime, datastore, Docker, ingress, and on-disk layout.
---

This page explains how Docklands is put together at runtime. You don't need it to
use Docklands, but it helps when operating, debugging, or sizing a server.

## The control plane

Docklands ships as a single **Next.js 16 application with a custom Node server**.
The App Router serves the dashboard UI and the API; a [tRPC](https://trpc.io)
layer exposes the backend, and a WebSocket server (on the same process) streams
build logs, container logs, and terminals.

- **Bun** is the package manager and task runner.
- **Node 24** is the runtime that actually executes the app — in development
  (`tsx server/server.ts`) and production (`node dist/server.mjs`) alike.

This split is deliberate: Docklands depends on native addons (`node-pty`,
`ssh2`, `dockerode`, `bcrypt`) and deploys on Node, so development exercises the
same runtime it ships on. Bun never runs the app process.

## Datastore

State lives in **PostgreSQL**, accessed through [Drizzle ORM](https://orm.drizzle.team)
over `postgres.js`. Schema migrations live in `apps/docklands/drizzle/` and are
applied on startup — the production entrypoint runs `migrate-db` before booting
the server. See [Operations](/install/operations/) for running migrations
manually.

Authentication is handled by [Better Auth](https://better-auth.com) with the
organization, admin, passkey, and API-key plugins. See
[Access control](/access/organizations/).

## Deployments and the queue

Deployments are processed through an **in-memory queue** inside the server
process. When you trigger a deploy, the work is enqueued and run by a worker that
clones/pulls the source, builds an image (if the source needs building), and
creates or updates a Docker Swarm service.

:::caution[The queue is in-memory]
Because the deployment queue lives in process memory, **a control-plane restart
drops in-flight and queued deployments.** They are not resumed automatically —
you re-trigger them. Keep this in mind when restarting or upgrading Docklands
while builds are running.
:::

## Docker, Swarm, and runtime workers

Docklands drives Docker through the Engine API (`dockerode`). On setup it
initializes **Docker Swarm**, an overlay network (`docklands-network`), and runs
core services as Swarm services.

Services are deployed on **runtime workers**:

- The **local worker** is the machine the control plane runs on.
- **Remote workers** are additional machines you add over SSH, so builds and
  workloads can run on other hosts. See [Runtime workers](/runtime/runtime-workers/).

By default Docklands talks to the local Docker socket. You can point it at a
different daemon with `DOCKLANDS_DOCKER_HOST` / `DOCKLANDS_DOCKER_PORT`, or the
standard `DOCKER_HOST`.

## Ingress

Inbound HTTP/HTTPS traffic is handled by **Traefik**, which Docklands runs as the
`docklands-traefik` service. When you attach a [domain](/networking/domains/) to
a service, Docklands writes a Traefik dynamic-config file for it; Traefik handles
TLS (including Let's Encrypt) and routing. The static configuration and the
Let's Encrypt resolver are generated during setup. See [Ingress](/networking/ingress/).

## On-disk layout

Runtime state lives under a base path: **`/etc/docklands` in production**, and
`.docker/` inside the repo in development. Key subdirectories:

| Path | Holds |
|---|---|
| `traefik/`, `traefik/dynamic/` | Traefik static + per-service dynamic config |
| `traefik/dynamic/certificates/` | Custom TLS certificate files |
| `applications/`, `compose/` | Per-service build/deploy working directories |
| `ssh/` | SSH keys used for Git and remote workers |
| `logs/` | Deployment and runtime logs |
| `monitoring/` | Metrics state |
| `registry/` | Local image-registry data |
| `volume-backups/`, `volume-backup-lock/` | Volume backup working state |
| `patch-repos/` | Patch/repository working state |

Back this directory up alongside the database if you want a complete restore
point — see [Operations](/install/operations/).

## What runs where

```
┌────────────────────────────────────────────────────────────┐
│ Your Linux VM                                               │
│                                                            │
│  Node 24 process ── Next.js (UI + tRPC + WebSocket)        │
│        │                                                   │
│        ├── PostgreSQL  (docklands-postgres)               │
│        ├── Docker Engine + Swarm                          │
│        │     ├── docklands-traefik   (ingress)            │
│        │     └── your services       (Swarm services)     │
│        └── /etc/docklands            (config, certs, keys) │
│                                                            │
│  Remote runtime workers ← SSH ← control plane (optional)   │
└────────────────────────────────────────────────────────────┘
```
