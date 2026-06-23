---
title: Services and Connections
description: Place services on the canvas, link them privately, and apply generated connection variables.
---

This page covers the day-to-day of the canvas: adding services, arranging their
cards, drawing private service-to-service connections, and — the key feature —
the **generated connection variables** those links can write into a service.

## Adding services

You add a service to the current environment from the canvas. The available
actions are:

- **New application** — deploy from Git, a Docker image, or a buildpack. See
  [Applications](/applications/overview/).
- **New database** — provision a managed PostgreSQL, MySQL, MariaDB, MongoDB,
  Redis, or libSQL instance. See [Databases](/databases/overview/).
- **New Compose stack** — bring your own `docker-compose.yml`. See
  [Compose](/compose/overview/).
- **Create from template** — start from a pre-built service template.
- **Import Compose** — paste or import a Compose definition.

On an empty canvas these appear as buttons in the centered **empty state**
("Empty canvas — start with a runtime, database, compose stack, or template").
Once you have services, reach the same actions through the
[command bar](/workspace/navigation/) (`⌘K` / `Ctrl+K`).

Adding any service requires the `service: create` permission. When you create a
service you can pick its **placement** — automatic placement (Docklands chooses a
runtime worker) or a specific [runtime worker](/runtime/runtime-workers/).

## Arranging cards

Every service is a card you can drag anywhere on the canvas. Positions are
**persisted per environment**: each card's `x`/`y` (and width/height) are saved
so the layout is the same the next time you or a teammate opens that
environment's canvas.

- A new service that has never been placed is given a **default grid position**
  (a 3-column grid) until you move it.
- Dragging a card saves its new position when you release it.
- **Arrange** (in the canvas header, or "Arrange workspace" in the command bar)
  resets every card back to the default grid in service order. This rewrites all
  saved positions for the environment.

:::note[Layout is per environment, shared across users]
Card positions are stored on the environment, not per user. Rearranging the
canvas changes the layout everyone sees for that environment.
:::

:::caution[Avoid dragging two cards at the same time from two tabs]
Saving a card position immediately refetches the whole canvas, and the refetch
replaces local card positions with the server's. If you (or a teammate) move a
different card in another tab while a save is in flight, the refetch can snap a
card you just moved back to its previous spot. If a card jumps back, drag it
again — the position that "wins" is whichever save landed last.
:::

## Connections

A **connection** is a private link between two services in the same environment.
It models that one service talks to another over the internal
[`docklands-network`](/networking/ingress/) — no public ingress required — and it
is the mechanism for projecting a database's generated variables into a consumer.

### Drawing a connection

1. Start a connection from a service card (the connect/cable control on the
   card). The canvas enters "connecting from <service>" mode.
2. Click the other service to complete the link.
3. Press `Escape` at any time to cancel.

A service cannot connect to itself. Re-drawing the same pair just updates the
existing link rather than creating a duplicate (the pair is unique per
environment).

### Direction is normalized automatically

Connections are **oriented**: the side that can expose variables (a managed
database engine) is always treated as the **source**, and the other side (an
application or Compose stack) as the **target** that receives variables. If you
draw the link in the "wrong" order — from an app to a database — Docklands
silently flips the endpoints so the database is the source. You do not have to
draw it in a particular direction.

### Removing a connection

Open the connection from the canvas and remove it. Removing a connection deletes
**only** the link metadata. It does **not** remove any variables that were
previously written into the target service's environment — those stay until you
edit them out. See the staleness note below.

## Generated connection variables

This is the reason connections matter beyond drawing lines. When the **source**
of a connection is a managed database, Docklands can generate that engine's
**connection variables** (for example a connection URL, host, port, user,
password, and database name) and write them into the **target** service's own
variable block — so an application can reach the database without you copying
credentials by hand.

For the exact variable names each engine produces, see
[Connection variables](/databases/connection-variables/).

### Applying variables when you connect

When you draw a connection whose source is a database, Docklands can apply the
generated variables to the target as part of creating the link, provided you have
the `envVars: write` permission. The connection is then labeled accordingly
(for example "Private network + variables" versus a plain "Private network" link
with no variables written).

Applications and Compose stacks have nothing to project, so a connection sourced
from them only establishes the private link — there are no generated variables.

### Applying or syncing later

You do not have to apply variables at connect time. From a connection you can:

- **Preview** the variable keys a connection would write (the key names only).
- **Apply** the connection's variables to the target on demand.
- **Sync** a service: re-apply the variables from **all** incoming connections
  into that one service at once.

Applying variables performs an **upsert** into the target's variable block: each
generated key is inserted if missing or updated in place if it already exists.
Your other variables are left untouched. All of these require `envVars: write`.

:::caution[Generated variables can go stale]
Applied variables are a **snapshot** written into the target's environment at the
moment you apply or sync. They are not a live binding. If the source database's
credentials change later — for example after a password rotation — the target
keeps the old values until you **apply** or **sync** again. Likewise, removing a
connection does not retract the variables it wrote. After rotating a database's
credentials, re-apply or re-sync every consumer, and redeploy the consumers so
they pick up the new values.
:::

:::tip[Redeploy to pick up changes]
Writing or updating a service's variables does not redeploy it. After applying or
syncing connection variables, deploy the target service so the running container
sees the new environment.
:::
