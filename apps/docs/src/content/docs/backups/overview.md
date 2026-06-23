---
title: Backups & Storage
description: How backup destinations, database backups, volume backups, and scheduled automations fit together in Docklands.
---

Docklands backs your data up to **S3-compatible object storage** that you own.
Nothing is stored on a Docklands-hosted service — you point Docklands at a
bucket, and it streams dumps and archives there with [`rclone`](https://rclone.org/).

There are three moving parts:

1. A **storage destination** — the S3 bucket and credentials that backups upload
   to. You configure these once under `/dashboard/settings/storage` and reuse
   them across every backup. See [Destinations](/backups/destinations/).
2. A **backup** — what gets captured. Docklands has two kinds:
   - [Database backups](/backups/database-backups/): a *logical dump* of a
     managed or compose-embedded database (PostgreSQL, MySQL, MariaDB, MongoDB),
     plus a full-instance "web server" backup of Docklands itself.
   - [Volume backups](/backups/volume-backups/): a `tar` archive of a Docker
     volume, for application data and for engines without a logical dump (Redis,
     libSQL).
3. A **schedule** — when it runs. Every backup carries a cron expression and can
   also be run on demand. Standalone cron jobs that run arbitrary commands live
   under [Automations](/backups/schedules/).

## The backup model at a glance

| You want to protect | Use | Format | Where it's configured |
| --- | --- | --- | --- |
| A managed Postgres/MySQL/MariaDB/Mongo database | [Database backup](/backups/database-backups/) | `*.sql.gz` / `*.bson.gz` | The database's **Backups** card |
| A database embedded in a compose stack | [Database backup](/backups/database-backups/) | `*.sql.gz` / `*.bson.gz` | The compose service's **Databases** tab |
| A Redis or libSQL data store | [Volume backup](/backups/volume-backups/) | `*.tar` | The service's **Volume Backups** tab |
| An application's on-disk volume | [Volume backup](/backups/volume-backups/) | `*.tar` | The application's **Volume Backups** tab |
| The whole Docklands instance | [Web-server backup](/backups/database-backups/#back-up-docklands-itself) | `*.zip` | A backup with type `web-server` |

## How a backup runs

Every backup follows the same shape. Docklands:

1. Builds a shell command that finds the running container, dumps or archives the
   data, and pipes it to `rclone`.
2. Runs that command **where the service runs** — on the Docklands host for local
   services, or on the assigned remote runtime worker over SSH for services
   pinned to one.
3. Streams the output straight to your S3 destination (database dumps are streamed
   without ever landing on disk; volume archives are written to a temp dir, then
   uploaded and deleted).
4. Records a deployment entry you can open from the backup's history, and sends a
   success or failure notification through any configured provider.

Because backups shell out to `docker` and `rclone` on the host, the host (or
runtime worker) needs Docker access and the `rclone` binary available — both are
present in the standard Docklands runtime image.

## Scheduling and retention

- **Schedules** are cron expressions evaluated by an in-process scheduler. The
  scheduler is (re)built from the database every time Docklands starts, so
  enabled backups resume automatically after a restart.
- **Retention** is optional and per-backup: set *keep latest N* to prune older
  files in the bucket after each successful run. Leave it empty (or `0`) to keep
  everything forever.

:::caution
Retention deletes files in your bucket. Docklands scopes the delete to its own
backup files by prefix and extension, but it is still a destructive `rclone
delete` against your storage. Pick the *keep latest* value deliberately, and
prefer object-lock / versioning on the bucket if you want a safety net.
:::

## In this section

- [Destinations](/backups/destinations/) — connect an S3-compatible bucket and
  test it.
- [Database backups](/backups/database-backups/) — logical dumps, retention,
  restore, and which engines are supported.
- [Volume backups](/backups/volume-backups/) — archive Docker volumes, with an
  optional stop-during-backup mode.
- [Automations](/backups/schedules/) — cron jobs for backups and custom commands,
  and how they execute.
