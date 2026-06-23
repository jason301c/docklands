---
title: Cluster and scaling
description: How Docklands uses Docker Swarm, joining nodes to the cluster, scaling services with replicas, and steering placement across nodes.
---

A single runtime worker can run many services, but when you want **more capacity
or redundancy** you grow that worker's host into a **cluster** of machines.
Docklands uses **Docker Swarm** for this: one host is the manager, and you join
additional machines as workers (or extra managers). Services then run as Swarm
services that can scale to multiple replicas spread across the nodes.

This is different from adding a *runtime worker*: a runtime worker is a separate
Docklands target with its own Swarm. The **cluster** is the set of Swarm nodes
behind a *single* worker (the local host, or one remote worker), all
participating in the same Swarm.

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
You need at least one **image registry** configured before you can add cluster
nodes — the Add Worker button only appears once a registry exists. Multi-node
Swarm relies on a registry so every node can pull the images it is scheduled to
run.
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
