---
title: What is Docklands?
description: A self-hosted, project-first deployment control plane you run on your own VM.
---

Docklands is a **self-hosted deployment control plane**. You install it on a
Linux machine you control, point it at that machine's Docker Engine, and use it
to deploy and operate applications, databases, and Docker Compose stacks — from
Git, container images, or a template catalog.

It is a community fork of [Dokploy](https://github.com/dokploy/dokploy), focused
on a cleaner, **project-first** workspace: services live on a canvas inside a
project, you draw private connections between them, and Docklands generates the
connection variables that wire them together.

:::note[Self-hosted, not hosted]
Docklands is software you run. There is no Docklands cloud. Docker Engine, the
filesystem, ports, secrets, domains, and your application data all live on
**your** machine. Everything in these docs assumes you own and operate the
underlying server.
:::

## What you can do with it

- **Deploy applications** from a connected Git provider, a public Git URL, a
  container image, or an uploaded archive — built with Nixpacks, a Dockerfile,
  Buildpacks, and more. See [Applications](/applications/overview/).
- **Run managed databases** — PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and
  libSQL — from one unified engine. See [Databases](/databases/overview/).
- **Deploy Docker Compose stacks** directly or from a
  [template catalog](/compose/templates/) of pre-built applications.
- **Arrange services on a project canvas**, connect them, and apply
  [generated connection variables](/workspace/services-and-connections/).
- **Route traffic** through the built-in Traefik ingress with automatic HTTPS.
  See [Networking](/networking/domains/).
- **Back up** databases and volumes to S3-compatible storage on a schedule. See
  [Backups](/backups/overview/).
- **Scale across machines** by adding remote runtime workers and Docker Swarm
  nodes. See [Runtime & cluster](/runtime/overview/).
- **Observe** deployments, logs, requests, and metrics. Audit logging is wired
  through parts of the app but not yet a reliable persisted trail. See
  [Observability](/observability/deployments-and-logs/).

## The object model

Everything in Docklands hangs off a small hierarchy. Understanding it makes the
rest of the docs click into place.

```
Organization            ← a tenant; owns users, members, and roles
└── Project (workspace)  ← a logical app/system, shown as a canvas
    └── Environment      ← e.g. production, staging — an isolated slice
        └── Service      ← the deployable unit, one of:
            ├── Application      (Git / image / archive → a container)
            ├── Compose          (a Docker Compose stack)
            └── Database         (a managed PostgreSQL/MySQL/… instance)
```

- An **organization** is the top-level tenant. Users belong to organizations as
  members, with [roles and resource-level permissions](/access/roles-and-permissions/).
- A **project** (also called a *workspace*) groups the services that make up one
  system. The primary UI is its [canvas](/workspace/overview/) at
  `/dashboard/workspace`.
- An **environment** is an isolated slice of a project — typically `production`
  and `staging`. Services, variables, and connections are scoped to an
  environment. See [Environments](/workspace/environments/).
- A **service** is the thing you actually deploy. The three first-class kinds —
  applications, compose stacks, and managed databases — share a deployment
  lifecycle but have their own settings.

## How a deployment runs

When you deploy a service, Docklands queues the work, prepares the source (clone
or pull), builds an image if needed, and runs it as a **Docker Swarm service**
on a [runtime worker](/runtime/runtime-workers/) — the local machine by default,
or a remote one you've added. [Traefik](/networking/ingress/) picks up the
routing for any domains you've attached. Live build and runtime logs stream back
to the dashboard.

The mechanics — the Node/Bun split, the in-memory queue, Swarm, Traefik, and the
on-disk layout — are covered in [Architecture](/concepts/architecture/).

## Status

Docklands is **pre-release** and should be treated as a fork-in-progress. There
are no upgrade guarantees yet, and some inherited surfaces are still being
migrated into the project-first model. Run it somewhere you're comfortable
rebuilding.
