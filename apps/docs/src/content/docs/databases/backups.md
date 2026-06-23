---
title: Database Backups
description: Schedule and run logical backups of a managed database to an S3-compatible destination.
---

Docklands can take **logical backups** of a managed database — a dump of the
database contents — and upload them to an S3-compatible storage destination on a
schedule or on demand. This page covers what is database-specific; for setting up
destinations and how schedules and retention work in general, see
[Backups](/backups/overview/).

## Which engines can be backed up

Logical backups use the engine's native dump tool, so they are only available
where Docklands has one:

| Engine | Dump tool | Backup file |
| --- | --- | --- |
| PostgreSQL | `pg_dump` (custom format) | `*.sql.gz` |
| MySQL | `mysqldump` | `*.sql.gz` |
| MariaDB | `mariadb-dump` | `*.sql.gz` |
| MongoDB | `mongodump` (archive) | `*.bson.gz` |

**Redis and libSQL do not support logical backups** in Docklands. Redis has no
dump command, and libSQL persistence is the data volume itself. To protect those,
use [volume backups](/backups/overview/) instead of a database backup.

## Before you start

You need at least one **storage destination** configured under
`/dashboard/settings/storage`. Until one exists, the backups card prompts you to
add one — you cannot create a backup without a destination.

The database must also be **running** when a backup runs: the dump command
executes inside the live container.

## Create a backup schedule

Open the database, go to its **Backups** card, and add a backup. You configure:

- **Destination** — the S3-compatible storage to upload to.
- **Database** — the name of the database/collection to dump. (For libSQL the
  field is fixed; for the web-server backup it is fixed to `docklands`.)
- **Schedule** — a cron expression for when the backup runs.
- **Prefix** — an optional path prefix inside the destination bucket.
- **Keep the latest** — optional retention; keep only the latest *N* backups and
  prune older ones. Leave empty to keep all.
- **Enabled** — toggle the schedule on or off without deleting it.

Uploaded files are stored under `<service-name>/<prefix><timestamp>.<ext>.gz`.

## Run a backup now

Each configured backup has a **Run Manual Backup** action that dumps and uploads
immediately, independent of the schedule. The run is recorded in the backup's
history, and retention (**keep latest**) is applied afterward just like a
scheduled run. If a backup fails, the error is recorded and a failure
notification is sent through any configured notification providers.

## How a database backup runs

When a backup runs, Docklands:

1. Locates the running container for the database's service.
2. Runs the engine's dump command inside it and pipes the output through `gzip`.
3. Streams the gzipped dump straight to the destination bucket with `rclone`.
4. Sends a success or failure notification and records a deployment entry you can
   inspect from the backup's history.

For databases pinned to a remote runtime worker, the dump runs on that worker
over SSH.

:::note
Backups are **logical dumps**, not volume snapshots. Restoring rebuilds data from
the dump into a running database; it does not restore the raw data volume. See
[Backups](/backups/overview/) for the restore flow and destination management.
:::
