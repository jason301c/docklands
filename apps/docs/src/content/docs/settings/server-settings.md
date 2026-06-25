---
title: Server Settings
description: Instance-wide control-plane settings — updates, build concurrency, runtime cleanup, request logging, host SSH key, server identity, and infrastructure health.
---

Server settings are the instance-wide knobs for the Docklands control plane
itself — distinct from per-application configuration. Because Docklands is
software you run on your own VM, these settings operate on your machine's Docker
runtime, Traefik ingress, and the control-plane process.

Most of these actions require an **owner or admin** role, and meaningful changes
are recorded in the audit log.

:::note
This page covers the general/instance-level settings. Ingress and Traefik,
TLS certificates, storage destinations, build workers, cluster nodes, SSH keys
for Git, users, roles, and your own profile each have their own settings pages
and docs.
:::

## Updates

Docklands can check whether a newer image is published and help you start the
update:

- **Check for updates** compares your running version against the latest
  available image tag.
- **Update** behaves according to how the control plane is installed. If
  Docklands is running as a Swarm service named `docklands`, it triggers a
  service update to the latest image and the control plane restarts as part of
  the update. If Docklands is running as the documented standalone
  `docker run` container, it pulls the latest image and tells the operator to
  recreate the container with the same mounts, network, and environment.

You can see the current version and release tag from the settings UI at any time.

:::caution
Updating or recreating the control-plane container interrupts the dashboard.
Deployments already running continue under Docker Swarm, but the in-memory
deployment queue is not preserved across the control-plane restart.
:::

## Build concurrency

**Builds concurrency** controls how many application builds the local runtime
runs at once (default `1`, configurable between `1` and `100`). Raising it speeds
up parallel deploys at the cost of more CPU and memory pressure on the host.
Docklands validates the requested value before applying it.

## Runtime (Docker) cleanup

Docklands can periodically reclaim disk by pruning unused Docker resources.

- **Enable runtime cleanup** schedules a recurring cleanup job. When enabled, the
  job prunes unused images, stopped containers, build cache, and dangling
  resources on a cron schedule, and can send a **Runtime Cleanup** notification
  (see [Notifications](/settings/notifications/)). You can enable cleanup for the
  local runtime or for a specific runtime worker.
- **Manual cleanup actions** are also available for one-off pruning: clean unused
  images, clean unused volumes, clean stopped containers, clean the Docker
  builder cache, run a full system prune, or clean everything. Long-running
  cleanups run in the background so the request returns immediately.
- **Docker disk usage** shows how much space images, containers, volumes, and
  build cache are consuming.

:::caution
Cleanup deletes Docker resources that are not currently in use. Volumes in
particular can hold data — review what a prune will remove before running it on a
host with important state.
:::

## Request logging

Docklands can turn on Traefik access logging so ingress requests are recorded and
viewable as host metrics.

- **Enable request logging** writes a Traefik access-log configuration so incoming
  requests are logged in JSON.
- **Log cleanup** schedules trimming of those logs on a cron schedule (default
  daily) so they don't grow without bound. Clearing the cron expression turns log
  cleanup off.

## Host SSH key

You can store a private SSH key the control plane uses to reach remote hosts.

- **Save SSH private key** stores the key for server-side use.
- **Clear SSH private key** removes it.

:::caution
This is a security-sensitive value. The host SSH private key is stored
server-side and is **never returned to the browser** — the UI only shows whether
a key is configured, not its contents. Anyone with database or host access can
read it, so scope the key's access on the remote side accordingly.
:::

## Server identity and domain

- **Server IP** records the public IP the instance advertises.
- **Assign domain** attaches a host to the control plane and configures Traefik
  to serve the dashboard, optionally over HTTPS with a Let's Encrypt or custom
  certificate. (Certificate setup itself is covered in the certificates docs.)

## Remote-only deployments

**Remote servers only** makes the instance schedule deployments onto remote
runtime workers rather than the local host. Use this when you want the control
plane host to stay free of application workloads.

## Infrastructure health

The settings surface can check that core infrastructure is reachable:

- **Postgres health** confirms the database accepts a connection.
- **Traefik health** confirms the ingress runtime is responding.

External monitoring can probe `/api/health` for database-backed liveness and
`/api/ready` for readiness, which also reflects critical production bootstrap
state such as network setup and the deployment worker.

## Other maintenance actions

- **Reload control plane / reload Traefik** recreate the respective Docker
  services to pick up configuration changes.
- **Clean deployment queue** clears the in-memory deployment queue if a deploy is
  stuck.
- **GPU support** can be set up and checked for the local runtime or a runtime
  worker, for workloads that need GPU access.

## A note on per-application "Security"

Docklands also has a **Security** feature attached to individual applications —
HTTP basic-auth users that protect a deployed app behind a username and password.
That is configured per service on the workspace canvas, not on this instance
settings page, and is documented with the application's networking options.
