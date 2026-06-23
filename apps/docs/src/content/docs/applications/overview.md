---
title: Applications Overview
description: What an application service is in Docklands, where it lives on the workspace canvas, and its deploy lifecycle.
---

An **application** is Docklands' first-class deployment unit: a single service
built from your source (Git, a public repo, a container image, or an uploaded
zip) and run as a Docker Swarm service behind the Traefik ingress runtime. If you
are deploying a web app, an API, a worker, or anything that ships as one
container, you create an application.

Applications are one of several service types Docklands manages. Managed
databases (PostgreSQL, MySQL, MariaDB, MongoDB, Redis, libSQL) and Compose stacks
are separate; this section is only about application services.

## Where applications live

Applications belong to an **environment** inside a **workspace**. The primary
surface is the project canvas at `/dashboard/workspace`: each service is a node
you can position, connect to other services, and open. Selecting an application
node opens its service page, where every configuration tab described in this
section lives.

A workspace can have multiple environments (for example a default environment
plus staging), and each application is scoped to exactly one. You can move an
application to another environment from its service page without recreating it.

## Anatomy of an application

When you create an application you give it a **name** and an optional
description; Docklands also generates a unique internal `appName` (the Docker
Swarm service name). From there you configure, in roughly this order:

1. **Source** — where the code or image comes from. See [Sources](/applications/sources/).
2. **Build type** — how source is turned into an image. See [Builds](/applications/builds/).
3. **Environment variables and secrets** — see [Environment variables](/applications/environment-variables/).
4. **Domains and ports** — how traffic reaches it. See [Domains](/applications/domains/) and [Ports](/applications/ports/).
5. **Advanced settings** — replicas, resource limits, run command, volumes, and Swarm tuning. See [Advanced settings](/applications/advanced/).

Optional features include per-app [HTTP basic auth](/applications/security/),
[preview deployments](/applications/preview-deployments/) for pull requests, and
[rollbacks](/applications/rollbacks/) to a previous image.

## Deploy lifecycle

Once a source and build type are set, you deploy from the application's **General**
tab. The available actions are:

- **Run Build** (deploy) — downloads the source, runs the build, and (re)creates
  the Swarm service. This is the full path.
- **Rebuild** (redeploy) — rebuilds the image from already-downloaded source
  without fetching new code.
- **Reload** — recreates the running service from the current configuration
  *without* rebuilding the image (useful after changing ports, volumes,
  resources, or Swarm settings).
- **Stop** — scales the service to zero replicas. The configuration is kept; the
  app is just not running.
- **Start** — scales a stopped service back up (requires a previous successful
  build).

Deploys do not run inline. They are placed on an in-memory **deployment queue**
that serializes work per service and per runtime worker, so two deploys of the
same application never run at once. While a build runs you can watch it live in
the **Deployments** tab (build logs) and, once the container is up, in the
**Logs** tab (container logs).

An application reports an `applicationStatus` of `idle`, `running`, `done`, or
`error`. A freshly created application is `idle` until its first successful
deploy.

:::note
Several settings — **ports**, **volumes/mounts**, **resources**, and **Swarm
orchestration** — only take effect on the next build (or a **Reload**). The UI
shows a reminder where this applies. Saving the form persists the change but does
not restart the container by itself.
:::

## Builds need resources

Builders (Nixpacks, buildpacks, Docker, Railpack) can consume significant CPU and
memory. If your control-plane VM is small, builds can fail or starve your running
services. For heavier builds, consider a dedicated **build worker** so image
creation is offloaded from the worker that runs your containers — see
[Advanced settings](/applications/advanced/).

## Deleting an application

Deleting an application removes its database record and then best-effort cleans up
the Swarm service, its Traefik config and middlewares, its deployment history, and
its on-disk build and monitoring directories. Cleanup is tolerant: if one step
fails the others still run, so a half-provisioned app can always be removed.

:::danger
Deletion is permanent and also removes deployment history. It does **not**
delete external data you mounted via bind mounts or named volumes on the host —
those are your responsibility to clean up separately.
:::
