---
title: Topology
description: How the canvas groups connected services into stacks.
---

**Topology** is the canvas's read-only view of how your services cluster
together based on the [connections](/workspace/services-and-connections/) you have
drawn. It answers "which services form a unit, and which ones stand alone?"

## Stacks are automatic

Topology grouping is **automatic**, not something you arrange by hand. Docklands
treats your connections as an undirected graph and finds each
**connected component** — every set of services reachable from one another
through connections. Each component with **two or more** services becomes a
**stack**.

- Draw a connection between two services and they join the same stack.
- A chain (A→B, B→C) puts A, B, and C in one stack, even though A and C are not
  directly linked.
- A single service with no connections is **unlinked** — it is not a stack of
  its own.

You never create or name stacks; they appear and dissolve as you add and remove
connections.

## The topology panel

Toggle the **topology panel** from the canvas header (or "Show topology" in the
[command bar](/workspace/navigation/)). It summarizes the current environment:

- **Stacks** — each connected group, with how many services and links it
  contains, and a breakdown of runtimes versus data stores. Selecting a stack
  highlights and selects all of its services on the canvas.
- **Unlinked** — services that have no connections at all, listed separately so
  you can spot anything that should be wired up.

## Stack outlines on the canvas

Beyond the panel, each stack is drawn as a dashed bounding box around its member
cards on the canvas, labeled with the stack's service and link counts. The box is
computed from the positions of the cards in the stack, so it moves and resizes as
you [drag cards](/workspace/services-and-connections/#arranging-cards). Keeping a
stack's cards near each other makes the outline tidy; the grouping itself does not
depend on position, only on connections.

## Topology counts

The canvas tracks a few environment-level counts you will see surfaced in the
panel and headers:

| Count | Meaning |
| --- | --- |
| services | Total services in the environment. |
| running | Services currently reporting `running`. |
| errors | Services whose last deploy/run reported `error`. |
| connections | Total connections drawn. |
| unlinked | Services with no connections. |

:::note
Topology reflects the connections you have drawn, not actual network traffic.
Two services that talk to each other but were never connected on the canvas will
show as unlinked. Draw the connection to model the relationship (and, for
database sources, to project [connection variables](/workspace/services-and-connections/#generated-connection-variables)).
:::
