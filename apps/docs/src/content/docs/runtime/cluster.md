---
title: Cluster and scaling
description: How Docklands uses Docker Swarm, joining nodes to the cluster, scaling services with replicas, and steering placement across nodes.
---

A single runtime worker can run many services, but when you want **more capacity
or redundancy** you grow that worker's host into a **cluster** of machines.
Docklands uses **Docker Swarm** for this: one host is the manager, and you join
additional machines as workers (or extra managers). Services then run as Swarm
services that can scale to multiple replicas spread across the nodes.

## When do you actually need this?

Most self-hosted setups never touch cluster nodes — **one machine runs ever
service you have, and that is fine.** Reach for a cluster only when a single host
is genuinely not enough:

- You want a service to survive one machine dying (run several replicas across
  hosts, and Swarm reschedules tasks off a failed node).
- One box can't hold the load and you want Docker to **automatically spread**
  containers across a pool of machines rather than pinning each one by hand.

If you only need to move *specific* services or builds onto *specific* extra
machines, you do **not** need a cluster — that is what runtime and build workers
are for (see the next section). Cluster nodes are the heavier "I'm running a real
fleet and want one shared scheduler" tier.

## Cluster nodes vs. runtime/build workers

This is the most common point of confusion. They are two different ways to add
machines, and they do not mix:

| | What it is | Who places the containers | Needs a registry? |
| --- | --- | --- | --- |
| **Cluster node** | An extra machine joined into the *same* Swarm | **Swarm decides** — spreads tasks across the pool | **Yes** — see below |
| **Runtime worker** | A separate SSH-reached host where services *run* | **You** pin a service to a specific worker | No |
| **Build worker** | A separate SSH-reached host that only *builds* images | n/a — it builds, then pushes to a registry | No |

So a **cluster node** is a machine you fold into one worker's Swarm so the
scheduler treats the whole pool as one target. A **runtime worker** is a distinct
Docklands target with its *own* Swarm that you assign services to deliberately,
and a **build worker** only compiles images. Adding a cluster node is *not* the
same as adding a runtime worker: the cluster is the set of Swarm nodes behind a
*single* worker (the local host, or one remote worker), all participating in that
worker's Swarm. See [Runtime workers](/runtime/runtime-workers/) for the worker
model.

## Why a cluster needs an image registry

Before the **Add Worker** button appears, you must have at least one
[image registry](/settings/image-registries/) configured. This is a hard
requirement of multi-node Swarm, not a Docklands preference.

When a service runs on a single machine, the image is built and run on that same
Docker Engine, so the image is already there locally. In a **multi-node** Swarm,
the node that ends up *running* a container is often **not** the node that built
the image — and a node can only see its own local image store. The image
therefore has to live somewhere every node can reach: a registry.

The flow is:

1. The image is pushed to the registry (Docker Hub, GHCR, DigitalOcean, a private
   one, etc.).
2. The manager deploys the stack with `--with-registry-auth`, which hands the
   registry credentials to every node.
3. Each node independently **pulls** the image from the registry and runs its
   assigned tasks.

Without a registry there is no shared place for nodes to pull from, so any task
scheduled onto a node other than the builder would have nothing to run. That is
why single-node setups and SSH runtime/build workers don't need a registry, but
cluster nodes do.

## Swarm initialization

You do not initialize Swarm by hand. When a worker is set up, the setup script
runs `docker swarm init` if the machine is not already in a Swarm, and creates
the `docklands-network` overlay network that every service shares. The machine
that initializes Swarm becomes the first **manager**.

## Joining nodes to the cluster

The **Settings → Cluster Nodes** page (`/dashboard/settings/cluster-nodes`) lists
the nodes in a worker's Swarm and lets you add more. Use the runtime worker
filter at the top to choose which worker's cluster you are managing.

Adding a node is a guided, copy-paste flow under **Add Worker**, with two tabs:

- **Worker** — joins the new machine as a Swarm worker (runs tasks).
- **Manager** — joins it as a manager (participates in the Swarm control quorum
  as well as running tasks).

For each, Docklands shows two commands to run **on the new machine**:

1. Install Docker at the matching version
   (`curl https://get.docker.com | sh -s -- --version <version>`).
2. The `docker swarm join --token <token> <ip>:2377` command, with the correct
   worker or manager join token and the manager's advertise address baked in.

:::caution
**All nodes in a cluster must share the same CPU architecture.** Joining an
arm64 machine to an amd64 cluster (or vice-versa) will break image scheduling,
because a service's image only runs on the architecture it was built for. The Add
Worker dialog warns about this.
:::

:::note
The Add Worker button only appears once at least one **image registry** is
configured — multi-node Swarm cannot work without one. See
[Why a cluster needs an image registry](#why-a-cluster-needs-an-image-registry)
above.
:::

The node list shows each node's **hostname, status, role, availability, engine
version,** and **created** date. Managers are flagged, and a node's detailed
config (labels, resources, platform) is available from its row.

## Removing a node

Removing a node from the cluster does two things in order: it **drains** the node
(`docker node update --availability drain`) so Swarm reschedules its tasks
elsewhere, then **force-removes** it (`docker node rm --force`).

:::caution
Node removal is **force-removal**. Draining moves running tasks off the node
first, but `docker node rm --force` does not wait for a clean departure, and the
machine still believes it is in the Swarm afterward (you may need to run
`docker swarm leave` on it manually to fully reset it). Removing a **manager**
can also break the Swarm's manager quorum if you drop below a majority — keep an
odd number of managers and never remove the last reachable manager.
:::

## Scaling a service with replicas

Each application has a **replicas** setting (default `1`) in its advanced
settings. Raising it tells Swarm to run that many identical tasks for the
service; Swarm spreads them across the available nodes and keeps the desired
count running, restarting tasks that die.

Replicas only help when there is somewhere to place them — a single-node cluster
runs every replica on that one machine. Scale out by joining more nodes first,
then raising replicas.

## Steering placement

Beyond the replica count, an application's **Cluster / Swarm settings** expose
the full Swarm service spec so you can control *where and how* tasks run,
including:

- **Placement** — **constraints** (hard rules, e.g. only nodes with a given
  label or role) and **preferences** (soft spreading, e.g. spread by a label).
- **Mode** — replicated vs. global (one task per node).
- **Update and rollback config** — how rolling updates and automatic rollbacks
  behave.
- **Restart policy**, **health check**, **networks**, **labels**, **endpoint
  spec**, and **stop grace period**.

Placement constraints reference Swarm node attributes such as node labels, roles,
and hostnames. To use a label-based constraint, label the node in Swarm first
(its config is visible from the node's row in Cluster Nodes), then add a
constraint like `node.labels.<key> == <value>` in the placement form.

:::note
These are raw Swarm service settings exposed directly. They are powerful but
unguarded — an over-strict constraint (for example, requiring a label no node
has) leaves the service with **no eligible node**, and its tasks stay pending. If
a service will not start after a placement change, loosen or remove the
constraint.
:::

## Watching the cluster

The **Cluster runtime** page (`/dashboard/cluster-runtime`) is the live view of a
worker's Swarm. It has:

- **Overview** — per-node monitoring (CPU, memory, and container stats), shown
  per node in the Swarm.
- **Containers** — the running tasks grouped by the node they landed on, so you
  can see how Swarm distributed your services.

Like the other runtime pages it has a runtime worker filter, so you can inspect
the cluster behind the local worker or any remote worker.
