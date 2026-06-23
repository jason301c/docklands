---
title: Database backups
description: Logical dumps of managed and embedded databases on a schedule, with retention and restore.
---

A **database backup** captures the logical contents of a database — a `pg_dump`,
`mysqldump`, `mariadb-dump`, or `mongodump` taken from inside the running
container, gzipped, and streamed to your [destination](/backups/destinations/).
It is *not* a snapshot of the data volume; restoring rebuilds the data from the
dump into a running database.

This page covers the backup mechanics shared by both database flavors. For where
each is configured, see [managed database backups](/databases/backups/) and
[compose-embedded database backups](/compose/embedded-databases/).

## Which engines are supported

Logical backups need the engine's native dump tool, so they exist only where
Docklands ships one:

| Engine | Dump tool | File |
| --- | --- | --- |
| PostgreSQL | `pg_dump` (custom format) | `*.sql.gz` |
| MySQL | `mysqldump` | `*.sql.gz` |
| MariaDB | `mariadb-dump` | `*.sql.gz` |
| MongoDB | `mongodump` (archive) | `*.bson.gz` |

**Redis** has no logical dump and is rejected outright when you try to add a
backup. **libSQL** has no logical *dump* either — to protect Redis or libSQL
data, use a [volume backup](/backups/volume-backups/) instead.

:::caution
The libSQL case is uneven today. The backup form will let you create a libSQL
*database* backup, but the dump step has no command for that engine and the run
fails. libSQL **restore** is implemented (it untars a gzip archive into
`/var/lib/sqld`), but there is no matching scheduled-dump path that produces such
an archive. Treat libSQL as **volume-backup only** until this is reconciled.
:::

## Before you start

- You need at least one [storage destination](/backups/destinations/). Until one
  exists, the backups card prompts you to add one; you cannot create a backup
  without a destination.
- The database must be **running** when the backup runs — the dump executes
  inside the live container. A stopped database produces a "container not found"
  failure.

## Create a backup

Open the database (or, for an embedded database, the compose service's
**Databases** tab) and add a backup. You configure:

- **Destination** — the S3 bucket to upload to.
- **Database** — the name of the database/collection to dump *inside* the
  container.
- **Schedule** — a cron expression for when it runs.
- **Prefix** — an optional path prefix inside the bucket.
- **Keep the latest** — optional retention (keep only the latest *N*; leave empty
  to keep all).
- **Enabled** — toggle the schedule without deleting the backup.

For a **managed** database, Docklands derives the engine automatically from the
database itself, so the stored backup type always matches the engine. Files land
under `<service-app-name>/<prefix><timestamp>.<ext>.gz`; embedded-database files
are nested under the service name within the compose stack's app name.

## Run a backup now

Each backup has a **Run Manual Backup** action that dumps and uploads
immediately, independent of the schedule. Manual runs apply [retention](#retention)
afterward exactly like scheduled runs, and record an entry in the backup's
history. **Run a manual backup after setup** to confirm credentials and
connectivity before trusting the schedule — this is the single best way to catch
a wrong password or unreachable bucket.

## How a dump runs

When a backup runs, Docklands:

1. Locates the running container for the database's service (for an embedded
   database, by its service name inside the compose stack).
2. Runs the engine's dump command inside it, piping through `gzip`. The pipeline
   uses `set -o pipefail`, so a failed dump fails the whole run rather than
   uploading a truncated file.
3. Streams the gzipped output straight to the bucket with `rclone rcat` — the
   dump never touches the host disk.
4. Records a deployment entry and sends a success/failure notification through any
   configured provider.

The dump runs **once** and is not re-read to "verify" it, which avoids doubling
load on the database and the risk of an inconsistent second copy. For databases
pinned to a remote runtime worker, the whole command runs on that worker over SSH.

:::caution
For **embedded** databases, the dump uses credentials Docklands extracted from
the compose file at detection time. If you later change the database password in
the stack — or the credentials were defaulted because the compose file used
non-standard variable names — backups will fail to authenticate until the stored
config matches. Verify with a manual run.
:::

## Retention

If **keep latest** is set to *N*, after each successful run Docklands lists the
backup files for this service/prefix (filtered to `*.sql.gz` / `*.bson.gz`),
sorts them newest-first, and deletes everything past the *N*th. An empty or `0`
value keeps everything.

:::caution
Retention sorts by **filename**, which begins with an ISO timestamp, so ordering
matches creation time as long as the timestamp prefix is intact. The delete is
scoped by prefix and extension to avoid touching non-Docklands files, but it is
still a real `rclone delete` against your bucket. If the retention step itself
errors, the failure is logged and swallowed — the backup is still reported as
successful, so stale files can accumulate silently. Spot-check the bucket
periodically.
:::

## Restore a backup

From a backup you can list the files in the destination and restore one. Restore
streams the chosen file back down and replays it into the running database:

- **PostgreSQL / MySQL / MariaDB** — the gzip is piped through `gunzip` into the
  engine client (`pg_restore --clean --if-exists`, `mysql`, or `mariadb`). Restore
  runs against the **live** database and overwrites matching objects.
- **MongoDB** — the archive is downloaded to a temp dir, decompressed, and
  replayed with `mongorestore --drop`.
- **libSQL** — the archive is untarred into `/var/lib/sqld` (see the caution
  above about the missing dump path).

Restore streams its log to the UI as it runs.

:::caution
**Restore is destructive and applied to a running database.** `pg_restore
--clean --if-exists`, `mysql`/`mariadb` replay, and `mongorestore --drop` all
overwrite or drop existing objects in place — there is no staging step and no
automatic pre-restore snapshot. Restore into a fresh or disposable database
first when you can, and take a fresh backup of the current state before
restoring over live data.
:::

## Back up Docklands itself

A special **web-server** backup type captures the whole Docklands instance: it
dumps the internal `docklands` Postgres database, copies the Docklands filesystem
state (excluding the volume-backups directory), zips them together, and uploads
the `.zip` to your destination. This is the backup to take before upgrades or
host migrations. It is host-only (it targets the local `docklands-postgres`
container) and is run with **Run Manual Backup** like any other.
