---
title: Managed Databases
description: One registry-driven engine for PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and libSQL services on your own VM.
---

A **managed database** is a database or cache that Docklands runs for you as a
container on your own infrastructure. You pick an engine, Docklands provisions
the container, generates credentials, wires connection variables into the
services that depend on it, and (where the engine supports it) runs scheduled
logical backups.

Managed databases are first-class services on the project canvas at
`/dashboard/workspace`. They sit alongside your applications and compose stacks,
and you connect a service to a database by drawing a link between them.

## Supported engines

Docklands ships six managed engines:

| Engine | Label | Default image | Container port |
| --- | --- | --- | --- |
| `postgres` | PostgreSQL | `postgres:18` | 5432 |
| `mysql` | MySQL | `mysql:8` | 3306 |
| `mariadb` | MariaDB | `mariadb:11` | 3306 |
| `mongo` | MongoDB | `mongo:8` | 27017 |
| `redis` | Redis | `redis:7` | 6379 |
| `libsql` | libSQL | `ghcr.io/tursodatabase/libsql-server:v0.24.32` | 8080 (plus 5001 gRPC, 5000 admin) |

The default image is only a suggestion — you can pin any compatible tag or
registry path when you create the database, and change it later.

## The engine registry

Every engine is described by a single **registry entry**. That one descriptor is
the source of truth for everything Docklands needs to know about the engine:

- which Docker images count as that engine (for compose detection);
- the default image and the port it listens on inside the container;
- the data volume mount path (PostgreSQL 18+ uses a version-specific path);
- how to build the container's environment from your credentials;
- the [connection variables](/databases/connection-variables/) it exposes to connected
  services;
- the [backup](/databases/backups/) dump command, where one exists;
- how to [change the password](/databases/managing/#change-the-password) in a running
  container.

The practical payoff for you: a PostgreSQL is a PostgreSQL whether you add it
from the database picker or it arrives bundled inside an app template. Both get
the same credentials handling, the same connection wiring, and the same backups.

:::note
Internally, all six engines are stored in one `database` table discriminated by
an `engine` column, with engine-specific credentials in a registry-validated
`config` field. You never interact with that directly — it just means every
engine behaves consistently and new engines can be added without new screens.
:::

## When to use a managed database vs. an embedded one

There are two ways a database can exist in Docklands:

- **Managed database** — created from the database picker on the workspace
  canvas (or routed there from a bare single-database template). It is an
  independently deployable service: you provision, start, stop, rebuild, and back
  it up on its own. This is the path this section documents.
- **Compose-embedded database** — a database that ships inside a multi-service
  compose template (for example, the Postgres bundled with an app). Docklands
  detects it and promotes it to a tracked database so it can still be backed up
  and exposed as connection variables, but its lifecycle is owned by the compose
  stack — you do not start or stop it on its own. See
  [Embedded databases in compose](/compose/embedded-databases/).

Use a **managed database** when the database is the thing you want to own and
operate directly — your application's primary store, a shared cache, a service
others connect to. Reach for an **embedded** database only when it comes packaged
with a multi-service app you are deploying as a unit.

:::tip
When you add a **template that is just a single database** (a bare Postgres,
Redis, etc.), Docklands steers you into the managed database picker preset to the
right engine, rather than deploying it as an opaque compose stack — so you get a
real managed database, not a black box.
:::

## What's in this section

- [Creating a database](/databases/creating-a-database/) — pick an engine, set
  credentials, choose placement.
- [Connection variables](/databases/connection-variables/) — how connected services
  consume generated credentials.
- [External access](/databases/external-access/) — expose a port to reach the database
  from outside the VM.
- [Backups](/databases/backups/) — scheduled and manual logical backups.
- [Managing a database](/databases/managing/) — provision, start, stop, reload, rebuild,
  change password, and read logs.
