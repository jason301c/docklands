---
title: Advanced Settings
description: Replicas, resource limits and ulimits, run command, volumes and mounts, redirects, build workers and registries, Swarm orchestration, and raw ingress config.
---

The **Advanced** tab groups the lower-level controls for an application: how many
copies run, how much CPU and memory they get, what command they run, what storage
they mount, and how they are scheduled and routed. It is visible if you have
service-edit permission.

:::note
Most settings here apply on the **next build** or a **Reload**, not the moment you
save. The relevant panels show a reminder.
:::

## Run command

**Run Command** sets a custom command and arguments to run in the container after
the image's default entrypoint — for example overriding the start command.

- **Command** — the executable, e.g. `/bin/sh`.
- **Arguments** — a list of args added one at a time, e.g. `-c`,
  `npm run start:prod`.

Leave these empty to use the image's own command.

## Orchestration: replicas and registry

The **Orchestration Settings** panel controls how the service is scheduled:

- **Replicas** — how many container copies run (minimum 1). More replicas spread
  load and survive a single task failing; your app must tolerate running multiple
  instances.
- **Registry** — the image registry this application uses. Selecting one makes
  Docklands push the built image to that registry so other workers can pull it.

There is also a **Modify Swarm Settings** action for fine-grained Docker Swarm
tuning (see below).

:::tip
Run a build after changing orchestration settings so they take effect.
:::

## Resources and ulimits

The **Resources** panel sets CPU and memory bounds:

- **Memory Reservation** / **Memory Limit** — the soft floor and hard ceiling for
  memory.
- **CPU Reservation** / **CPU Limit** — the soft floor and hard ceiling for CPU.
- **Ulimits** — per-resource OS limits (soft/hard) such as `nofile`, `nproc`,
  `memlock`, `stack`, and others.

Reservations help the scheduler place tasks; limits cap how much a container can
consume so one app cannot starve the host. Set limits conservatively on a shared
VM.

## Volumes and mounts

The **Volumes** panel persists data and injects files. Containers are otherwise
ephemeral — anything written inside a container is lost when it is replaced, so use
a mount for anything that must survive a redeploy. Three mount types:

- **Volume** — a named Docker volume managed by the engine. Give it a **Volume
  Name** and a **Mount Path** inside the container. Best default for persistent
  data.
- **Bind** — a path on the host (**Host Path**) mounted into the container at a
  **Mount Path**. Use when you need to share a specific host directory.
- **File** — inline **Content** you author in Docklands, written to a **File
  Path** and mounted at a **Mount Path**. Handy for config files.

:::caution
Mounts apply on the next build or **Reload**. Deleting a mount in Docklands does
not delete the underlying named volume or host directory — clean those up yourself
if you no longer need the data.
:::

## Redirects

The **Redirects** panel forwards or rewrites requests at the ingress edge. Each
redirect has:

- **Regex** — a pattern matched against the request.
- **Replacement** — the target the matched request is rewritten to.
- **Permanent** — whether to issue a permanent (301) redirect instead of a
  temporary one.

Use redirects to send old paths to new ones, or to canonicalize URLs. They work
together with your [domains](/applications/domains/).

## Build worker and build registry

By default an application builds on the same runtime worker that runs it. The
**Build Worker** panel lets you offload builds to a dedicated worker so image
creation does not compete with your running containers.

- **Build Worker** — the worker that performs the build.
- **Build Registry** — where the built image is pushed so the runtime worker can
  pull it.

These two must be set **together** (both selected, or both `None`); a build worker
needs a registry to hand the image off through.

:::note
After a build worker finishes, the runtime worker still needs a few seconds to
pull the image before the container starts. Those pull logs do **not** appear in
the build logs — watch the **Logs** tab to see the container come up.
:::

## Swarm orchestration settings

Behind **Modify Swarm Settings**, Docklands exposes raw Docker Swarm service
fields for advanced scheduling and reliability. These map directly to Swarm's
service spec and include:

- **Health check** — command, interval, timeout, retries, start period.
- **Restart policy** — condition, delay, max attempts, window.
- **Placement** — constraints and preferences for which nodes run the task.
- **Update config** and **rollback config** — rolling-update parallelism, delay,
  and failure behavior.
- **Service mode** — replicated vs. global.
- **Networks**, **labels**, **endpoint spec**, **stop grace period**, and
  **ulimits**.

These are power-user settings; an invalid value can prevent the service from
scheduling. Leave them empty to use Docklands' defaults derived from the simpler
panels above.

## Raw ingress config

The **Ingress Config** panel shows the generated Traefik configuration for this
application and lets you override it.

:::danger
Editing the raw ingress config replaces what Docklands generates. An invalid
config can break ingress for this application entirely. Use it only when you need
routing behavior the standard domain/redirect/port settings cannot express, and
keep a copy of the working config before you change it.
:::
