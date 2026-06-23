---
title: Runtime workers
description: The local worker, adding remote runtime workers over SSH, build workers, and how a service picks which worker builds and runs it.
---

A **runtime worker** is a machine Docklands can run work on. The machine
Docklands itself is installed on is the **local runtime worker**; every other
machine is a **remote** runtime worker you register and reach over SSH. Workers
let you spread services across more than one host and offload heavy image builds
off your production machine.

## Worker roles

Every worker has a **role**, stored as its type:

- **Runtime worker** (`deploy`) — runs your applications, databases, and Compose
  services. This is the default.
- **Build worker** (`build`) — dedicated to *building* images. It compiles and
  builds applications and pushes the result to a registry, taking that load off
  your runtime workers. A build worker does **not** appear in the runtime
  options where you choose where a service runs.

You pick the role when you create the worker. The setup script for a build worker
is lighter: it installs Docker and the build tools (Nixpacks, Buildpacks,
Railpack) but skips the ingress runtime, Swarm init, and Traefik that a full
runtime worker needs.

## Adding a remote worker

Remote workers are managed under **Settings → Runtime**
(`/dashboard/settings/runtime`). Use **Create Worker** and provide:

- **Name** and an optional **Description**.
- **Worker Role** — Runtime Worker or Build Worker.
- **SSH Key** — the key Docklands uses to authenticate to the machine. Add the
  matching public key to the worker's `~/.ssh/authorized_keys` first. Manage keys
  under Settings → SSH Keys.
- **IP Address**, **Port** (SSH, usually `22`), and **Username** (`root`, or a
  non-root user with passwordless sudo).
- **Enable Runtime Cleanup** — prune unused images daily on this worker.

:::note
Docklands authenticates to every remote worker with an **SSH private key**, not a
password. If the username is not `root`, that user needs **passwordless sudo**,
because the setup script installs packages and configures Docker. The setup
script prints the exact `sudoers` line to add if sudo is not already
passwordless.
:::

## Setting up a worker

Adding a worker only records its connection details. To make it usable you run
**Setup**, which connects over SSH and runs an installation script on the
machine. For a runtime worker the script:

1. Installs base utilities (curl, wget, git, jq, openssl).
2. Validates that ports `80` and `443` are free.
3. Installs RClone (for backups).
4. Installs Docker (pinned version, auto-detecting your Linux distribution).
5. Initializes Docker Swarm.
6. Creates the `docklands-network` overlay network.
7. Creates the `/etc/docklands` directories.
8. Writes the Traefik config and middlewares.
9. Starts the `docklands-traefik` ingress container.
10. Installs the builders (Nixpacks, Buildpacks, Railpack).
11. Configures permissions (adds the user to the `docker` group).

A build worker runs the trimmed version: Docker, directories, builders, and
permissions only.

The setup runs with **live logs** streamed to the UI, and the result is recorded
as a deployment so you can review it later. You can also **edit the script**
before running it if your machine needs custom steps, and the worker remembers a
custom command if you save one.

:::caution
Running setup is **destructive infrastructure work** on the target machine: it
installs and pins a specific Docker version, initializes Swarm, binds ports `80`
and `443`, and creates an overlay network. Point it at a machine you are
comfortable mutating — ideally a dedicated VM, not a laptop that holds other
Docker containers, networks, or port bindings.
:::

After setup you can **Validate** a worker (checks Docker, RClone, the builders,
the `docklands-network`, Swarm, the main directory, and Docker group membership)
and run a **Security audit** (checks UFW, SSH hardening, a non-root sudo user,
unattended upgrades, and fail2ban).

## How a service picks its workers

A service can use up to two different workers:

- **Runtime worker** — *where the service runs.* Set per service. If left unset,
  the service runs on the local runtime worker.
- **Build worker** — *where the image is built.* Optional, applications only.

For an **application**, you choose the build worker on the application's advanced
settings under **Build Worker**. There you select both a **Build Worker** and a
**Build Registry** — they must be configured together (or both left as None),
because the build worker builds the image, pushes it to that registry, and the
runtime worker then pulls it from there. The build-worker dropdown only lists
workers whose role is *build* and that have an SSH key.

At deploy time Docklands chooses the build target as "build worker if set,
otherwise the runtime worker", so a service with no build worker simply builds on
the same machine it runs on.

:::note
After a build finishes on a build worker, the runtime worker still has to **pull
the image** from the registry before the container starts. That pull happens
*after* the build logs end, so a brief gap between "build done" and "container
running" is expected — watch the service's Logs tab, not the build logs, to see
the container come up.
:::

:::caution
**Build workers are an application-only feature.** Compose services have no
separate build worker — they always build on their assigned runtime worker. If
you need build offloading for a Compose stack, there is currently no way to point
its build at a different machine.
:::

## Concurrent builds

Each worker has its own **concurrent builds** limit, configured under **Settings
→ Build Workers** (`/dashboard/settings/build-workers`). The local runtime worker
and every remote worker get their own value. Builds of the *same* service are
always serialized; the limit only controls how many *different* builds run at
once on that worker.

Raise this only as far as the machine's CPU, memory, and disk can handle — each
concurrent build runs its own builder and image build, and setting it too high
can exhaust memory and make builds fail.

## Removing a worker

You can only delete a worker that has **no active services** (applications,
databases, or Compose) assigned to it — move or delete those first. Deleting a
worker also removes its deployment history. Its SSH key is left untouched.

## Remote-only mode

Settings → Runtime also has a **Remote Workers Only** toggle. When enabled, every
service must run on a remote worker and running directly on the Docklands host
runtime is disallowed. Use this when you want the control-plane machine to stay
free of workloads.
