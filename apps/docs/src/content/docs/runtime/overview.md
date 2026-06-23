---
title: Container runtime overview
description: How Docklands runs your services as Docker Swarm services on the host, the runtime-worker model, and the container runtime view.
---

Docklands runs every service you deploy as a container on a real Docker Engine —
the one installed on the VM where you run Docklands, plus any remote machines you
add. There is no hosted layer: the containers, images, volumes, networks, and
ports all live on **your** hosts. This page explains the runtime model so the
rest of this section (workers, the cluster, and Docker resources) makes sense.

## The pieces

Docklands is a single control-plane process that talks to Docker in two ways:

- **Locally**, it talks to the Docker Engine on the same machine through the
  Docker socket (`dockerode`).
- **Remotely**, it talks to other machines over **SSH**, running `docker`
  commands on them and reusing the same socket via an SSH tunnel.

Each machine Docklands can run work on is a **runtime worker**. The machine
Docklands itself runs on is the *local runtime worker* (often shown as "Local
runtime worker" or "Docklands local runtime" in the UI); every other machine is
a *remote* runtime worker you add over SSH. See
[Runtime workers](/runtime/runtime-workers/) for how to add and set them up.

## Docker Swarm under the hood

Docklands does not run your services as plain `docker run` containers. It uses
**Docker Swarm**, Docker's built-in orchestrator. On startup (in server mode)
Docklands makes sure the host is a Swarm manager and that an overlay network
called `docklands-network` exists, then deploys each application and managed
database as a **Swarm service** on that network.

Running on Swarm is what gives Docklands:

- **Replicas** — a service can run more than one identical container (task), and
  Swarm keeps the desired count running.
- **Placement** — Swarm decides which node a task lands on, optionally guided by
  the constraints and preferences you set.
- **Rolling updates and rollback** — Swarm replaces tasks gradually on redeploy
  and can roll back to the previous spec.
- **A stable internal network** — every service is reachable by its app name over
  `docklands-network`, which is how service-to-service connections and the
  Traefik ingress runtime reach your containers.

:::note
Swarm is an engine detail, not a product surface. In the Docklands UI you work
with *services*, *runtime workers*, and *replicas*; "Swarm", "stack", and "node"
appear in raw Docker commands, logs, and the cluster view, but you rarely need to
drive Swarm directly.
:::

Some workloads run as **standalone** containers or **Compose** stacks instead of
Swarm services — for example Traefik (`docklands-traefik`) runs as a standalone
container, and Compose services run as a `docker compose` project or a Swarm
stack depending on the Compose type. The container runtime view shows all of
them.

## The container runtime view

The **Container runtime** page (`/dashboard/container-runtime`) is a live view of
the containers running on a worker. It runs `docker ps` under the hood and lists
each container with its name, image, ports, and state.

From here you can, per container:

- **Start / Stop / Restart / Kill / Remove** the container.
- Open a **terminal** inside the container.
- Stream **logs** (with tail, since, and search filters).
- Inspect the container **config**, **mounts**, and **networks**.
- **Upload a file** into the container.

At the top of the page is a **runtime worker filter**: a dropdown that switches
the view between the local runtime worker and any remote workers you have added.
Selecting a remote worker runs the same `docker` inspection commands over SSH on
that machine, so you see its containers instead.

:::note
Docklands hides its own infrastructure containers from this list (anything named
`docklands-*`), except the monitoring container. You are looking at *your*
services, not the control plane.
:::

These container actions are gated by the `docker` permission and are audited, so
who started, stopped, or removed a container is recorded in the audit log.

## Where to go next

- [Runtime workers](/runtime/runtime-workers/) — add remote machines over SSH,
  set them up, and choose build workers.
- [Cluster](/runtime/cluster/) — initialize Swarm, join nodes, scale services
  with replicas, and steer placement.
- [Docker resources](/runtime/docker-resources/) — manage and clean up images,
  volumes, and networks on each host.
