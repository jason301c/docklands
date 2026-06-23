---
title: Databases embedded in a stack
description: How Docklands detects databases inside a Docker Compose stack and promotes them to first-class services for connection info and backups.
---

A Compose stack often bundles its own database — a Postgres, MySQL, MongoDB,
Redis, or similar service declared right inside the Compose file. Docklands does
not treat these as opaque containers. When you deploy a
[template](/compose/templates/) or import a Compose file, Docklands **detects the
database services inside the stack** and promotes each one to a first-class
record called an **embedded database** (internally, a `service_database`).

The stack still owns the database's lifecycle — it starts and stops with the
Compose service, and it is removed when the service is deleted — but the embedded
database becomes a first-class citizen for two things: **connection information**
and **backups**.

## How detection works

When a template or Compose file is processed, Docklands inspects each service and
decides whether it is a managed database. The decision combines the service's
image name with surrounding context, to avoid mislabeling an app that merely
embeds a database keyword in its image name:

- The **image base name** must match one of the six engines' known images (for
  example `postgres`, `mysql`, `mariadb`, `mongo`, `redis`,
  `tursodatabase/libsql-server`, and common variants like `pgvector`,
  `timescaledb`, `bitnami/postgresql`, `valkey`).
- A short **denylist** rejects images that look like databases but are
  applications (for example `postgrest`, `metabase`, `supabase/postgres-meta`,
  and the `supertokens-*` images).
- **Context** confirms or rejects the match: a standard database port, an
  engine-specific environment variable (such as `POSTGRES_PASSWORD`), or an
  engine-specific healthcheck (such as `pg_isready`) all argue *for* a database;
  clear application signals (env keys like `SERVICE_FQDN`, `API_KEYS`, `APP_*`,
  `APPLICATION_*`) with no database signal argue *against* it.

Each detected database records its **service name** (the key inside the Compose
file, which is also the hostname other services use to reach it), its **engine**,
its **image**, and a **config** of credentials extracted from the service's
resolved environment.

:::caution
Detection is a heuristic, and credential extraction is best-effort. A custom or
unusual image may be missed (a false negative) or, more rarely, an app image
could be mistaken for a database (a false positive). If credentials in the
Compose file use names Docklands does not recognize, the extracted config falls
back to engine defaults (for example user `postgres`, an empty password), which
can make connection info and backups inaccurate until corrected. Treat the
generated connection variables as a starting point and verify them against your
Compose file.
:::

## Seeing embedded databases

Open the Compose service in your workspace. When the stack has at least one
detected database, a **Databases** tab appears. It lists each detected database
as a card showing its service name, engine, and image.

### Connection variables

Expand **Connection variables** on a database card to see the
ready-to-use environment variables for reaching that database from other services
in the same stack — for example `DATABASE_URL`, `POSTGRES_HOST`,
`POSTGRES_USER`, and `POSTGRES_PASSWORD` for Postgres, or `REDIS_URL` for Redis.
The host in these values is the database's **service name**, because that is the
name other containers in the same Compose project use to reach it over the
internal network.

Secret-looking values (passwords, URLs, tokens) are masked behind a
show/copy control; plain values like host and port are shown directly. These
variables are **read-only** — they reflect what Docklands extracted from the
Compose file, not a separate store you edit here.

## Backing up an embedded database

Embedded databases that support a **logical dump** can be backed up on a
schedule, just like a managed database. Supported engines are **PostgreSQL,
MySQL, MariaDB, and MongoDB**. **Redis and libSQL do not support logical backups**
and will not show a backup section.

To configure a backup you first need at least one storage provider. If none is
configured, the card links you to **Settings → Storage** to add one.

A backup is configured with:

- **Destination** — the storage provider/bucket to upload to.
- **Database** — the name of the database *inside* the container to dump (for
  example the Postgres database name).
- **Schedule** — a cron expression for when the backup runs.
- **Prefix** — an optional path prefix within the destination bucket.
- **Keep latest** — optionally retain only the most recent N backups; leave empty
  to keep all.
- **Enabled** — toggle the schedule on or off.

You can edit or delete a configured backup, and run one immediately with **Run
Manual Backup**. Backup runs appear in the build-history modal for that backup.

### How a backup runs

When a backup runs, Docklands locates the database's container *inside the running
Compose stack* by its service name, runs the engine's dump command inside that
container (for example `pg_dump` for Postgres, `mongodump` for MongoDB), gzips the
output, and streams it to your storage destination. Backups are uploaded under a
path derived from the stack's app name and the database's service name. If the
service runs on a remote runtime worker, the dump runs there over SSH.

:::caution
The backup reads credentials from the config Docklands extracted at detection
time. If you later change the database password inside the stack (or the
extracted credentials were defaulted because the Compose file used non-standard
variable names), backups can fail to authenticate until the stored config matches
the running database. Use **Run Manual Backup** after setup to confirm the backup
actually succeeds before relying on the schedule.
:::

:::note
Embedded-database backups cover the database's logical contents only. To capture
a stack's on-disk volumes (including databases without logical-dump support, like
Redis or libSQL), use the Compose service's **Volume Backups** tab instead.
:::
