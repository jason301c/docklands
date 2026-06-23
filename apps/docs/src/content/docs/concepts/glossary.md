---
title: Glossary
description: The core Docklands terms and how they relate.
---

A quick reference for the vocabulary used throughout these docs.

### Organization
The top-level tenant. Owns users, members, roles, and all projects. Backed by
Better Auth's organization plugin. See [Organizations](/access/organizations/).

### Project / Workspace
A group of related services, presented as a [canvas](/workspace/overview/) at
`/dashboard/workspace`. "Project" and "workspace" refer to the same thing — the
UI calls the surface a workspace.

### Environment
An isolated slice of a project (e.g. `production`, `staging`). Services,
variables, and connections are scoped to an environment. See
[Environments](/workspace/environments/).

### Service
The deployable unit inside an environment. One of three first-class kinds:
**Application**, **Compose**, or **Database**.

### Application
A service built from source (Git, container image, or uploaded archive) and run
as a single container/Swarm service. See [Applications](/applications/overview/).

### Compose
A service defined by a Docker Compose file — a multi-container stack deployed
together. See [Compose](/compose/overview/).

### Database (managed)
A first-class managed database instance (PostgreSQL, MySQL, MariaDB, MongoDB,
Redis, or libSQL), provisioned and operated by Docklands through its unified
[database engine](/databases/overview/).

### Embedded database
A database detected *inside* a Compose stack and promoted to first-class for
connection info and backups, without being a standalone managed database. See
[Embedded databases](/compose/embedded-databases/).

### Connection variable
An environment variable Docklands generates when you connect one service to
another on the canvas — for example a database connection string injected into an
app. See [Services & connections](/workspace/services-and-connections/).

### Runtime worker
A machine that runs builds and workloads. The **local** worker is the control
plane's host; **remote** workers are added over SSH. Formerly called a "server".
See [Runtime workers](/runtime/runtime-workers/).

### Build worker / build registry
The runtime worker chosen to *build* a service's image, and the registry its
built/rollback images are pushed to. See [Image registries](/settings/image-registries/).

### Ingress
The inbound traffic layer, powered by **Traefik** (the `docklands-traefik`
service). Handles domains, TLS, and routing. See [Ingress](/networking/ingress/).

### Destination
An S3-compatible storage target that backups are uploaded to. See
[Destinations](/backups/destinations/).

### Template
A pre-built Docker Compose application in the [catalog](/compose/templates/),
deployable in a couple of clicks.

### Preview deployment
An ephemeral environment spun up for a pull request, torn down when the PR
closes. See [Preview deployments](/applications/preview-deployments/).

### Rollback
A previously built, registry-stored image you can redeploy to revert a service.
See [Rollbacks](/applications/rollbacks/).

### Swarm
Docker Swarm — the orchestration mode Docklands initializes and uses to run
services and scale across [cluster nodes](/runtime/cluster/).
