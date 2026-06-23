---
title: Volume backups
description: Archive a Docker volume to S3-compatible storage, with an optional stop-during-backup mode.
---

A **volume backup** captures the raw contents of a named Docker volume as a
`tar` archive and uploads it to your [destination](/backups/destinations/). Use
volume backups for:

- **Application data** — uploads, generated files, anything an app writes to a
  mounted volume.
- **Databases without a logical dump** — Redis and libSQL have no
  [database backup](/backups/database-backups/), so a volume backup of their data
  volume is how you protect them.
- **Anything else on a volume** that a logical dump would not capture.

Volume backups are configured per service, on the **Volume Backups** tab of an
application or compose service.

## Create a volume backup

You configure:

- **Name** — a label for the backup.
- **Volume name** — the Docker volume to archive.
- **Destination** — the S3 bucket to upload to.
- **Prefix** — an optional path prefix inside the bucket.
- **Cron expression** — when the backup runs.
- **Keep latest** — optional retention (keep only the latest *N* archives; leave
  empty to keep all).
- **Stop service during backup** (`turnOff`) — see [below](#consistency-and-the-stop-option).
- **Enabled** — toggle the schedule without deleting the backup.

Archives are named `<volume>-<timestamp>.tar` and stored under a path derived
from the service's app name (and service name, for compose).

## How a volume backup runs

Docklands runs a short-lived `ubuntu` helper container that mounts the target
volume read-only-style alongside a host backup directory and runs `tar` to
archive the volume's contents. The resulting `.tar` is uploaded with `rclone`,
then the local copy is deleted. On any failure, leftover `.tar` files for that
backup are cleaned up.

As with every backup, the work runs on the remote runtime worker the service is
pinned to, or on the Docklands host otherwise, and emits a deployment entry plus a
success/failure notification.

## Consistency and the stop option

By default a volume backup archives the volume **while the service keeps
running**. That is fast and non-disruptive, but it copies a live, possibly
mid-write filesystem — fine for mostly-static assets, risky for a database's data
files, where an in-flight write can produce an inconsistent archive.

Enable **stop service during backup** (`turnOff`) for a consistent copy. With it
on, Docklands:

1. Acquires a per-service lock (via `flock`, falling back to a lock directory) so
   two backups of the same service can't run at once.
2. Scales the service to **0 replicas** (Swarm) or stops the container (plain
   compose), recording the original replica count.
3. Archives the now-quiet volume.
4. **Restarts the service** to its original replica count, then uploads.

:::caution
The stop option causes **downtime** for the duration of the archive — the service
is fully stopped while `tar` runs, which on a large volume can be minutes.
Schedule these backups for a low-traffic window. For a database, prefer a
[logical database backup](/backups/database-backups/) where the engine supports
one (Postgres/MySQL/MariaDB/Mongo); reserve stop-mode volume backups for Redis,
libSQL, and app data that has no online-consistent dump.
:::

## Run a backup now

Each volume backup has a **run now** action that archives and uploads
immediately. Retention is applied afterward, just like a scheduled run.

## Retention

If **keep latest** is set, after a successful run Docklands lists this volume's
`*.tar` files for the service/prefix, sorts newest-first, and deletes everything
past the *N*th. As with database backups, retention is a real `rclone delete`
scoped by name and extension, and a retention error is logged but does not fail
the backup.

## Restore a volume backup

Restoring downloads the chosen `.tar` from your destination and untars it back
into the named volume. Before writing, Docklands checks whether the volume is in
use:

- If the volume **doesn't exist**, it restores directly.
- If the volume exists but **no container uses it**, Docklands removes the
  existing volume and restores.
- If the volume **is in use** by any container (running or stopped), the restore
  **aborts** and prints the containers holding it, so you can stop them first.

:::caution
Volume restore overwrites the volume's contents and will not run while anything
has the volume mounted. Stop every service using the volume before restoring. The
restore runs the same `ubuntu` + `tar` helper as the backup, on the service's
runtime worker or the host.
:::
