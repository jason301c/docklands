---
title: Ports
description: Publish container ports directly to the host or the Swarm ingress mesh for TCP/UDP traffic.
---

Most web traffic should reach your application through a [domain](/applications/domains/),
which routes HTTP/HTTPS via the ingress runtime. **Ports** are for the cases where
you need to publish a raw TCP or UDP port — a database protocol, a game server, a
gRPC endpoint, anything that is not plain HTTP behind a hostname.

You manage ports under **Advanced → Ports** ("the ports allows you to expose your
application to the internet").

## Adding a port

Each port maps a port published outside the container to a port inside it:

- **Published Port** — the port exposed externally.
- **Target Port** — the port your application listens on inside the container.
- **Protocol** — `TCP` or `UDP`.
- **Published Port Mode** — `host` or `ingress`:
  - **host** publishes the port directly on the worker node that runs the task.
    The port lands on that specific machine's network interface.
  - **ingress** publishes through the Swarm routing mesh, so the port is reachable
    on any node in the cluster and load-balanced across replicas.

A typical mapping might publish host port `5432` to target port `5432` over TCP to
expose a service's database protocol, or use ingress mode to load-balance a TCP
service across replicas.

:::note
Ports take effect on the next build or **Reload**, not the instant you save. The
UI shows a reminder to run a build after adding, editing, or deleting ports.
:::

:::caution
A published port opens your application to the network on the host. Make sure the
target port is one your container actually listens on, that the published port is
not already in use, and that your firewall/security-group rules match what you
intend to expose. Docklands does not add authentication to a raw published port —
for HTTP, prefer a domain plus [basic auth](/applications/security/) if you need
to restrict access.
:::

:::tip
If two applications try to publish the same host port on the same node, the second
will fail to start. Use the ingress routing mesh, distinct ports, or a domain to
avoid collisions.
:::
