---
title: Backup schedules
description: How Docklands runs backup cron schedules, and what standalone automations do not ship yet.
---

Docklands v0.1.0 supports **scheduled backups** for database backups and volume
backups. A backup schedule is a cron expression stored on the backup itself; when
enabled, Docklands registers the job when the control plane starts and when the
backup is changed.

General-purpose standalone automations are **not shipped in v0.1.0**. There is
no host-level automation dashboard and no service command scheduler in the
current product. If you need arbitrary recurring commands, run them outside
Docklands with your host scheduler or CI system.

## Where schedules are configured

Backup schedules live with the backup they run:

- database backup schedules are configured on the database or compose service
  backup form;
- volume backup schedules are configured on the service's **Volume Backups** tab;
- every backup can also be run manually with **Run now**.

Each backup has:

- **Cron expression** — when it runs;
- **Enabled** — whether the schedule is active;
- **Keep latest** — optional retention after successful runs;
- **Destination** — the S3-compatible storage target.

## How scheduled backups run

When a schedule fires, Docklands runs the same backup path used by a manual run:

1. find the service/database to back up;
2. run the dump or archive command where the service runs;
3. stream or upload the result to the configured destination;
4. apply retention if configured;
5. record a deployment/log entry for the run.

Database backups stream logical dumps through `rclone`. Volume backups create a
temporary tar archive, upload it, and then remove the temporary file.

## Reliability and restarts

The scheduler runs **in-process** inside Docklands, not as a separate daemon.
This has a few operational consequences:

- enabled backup schedules are reloaded on startup;
- if Docklands is down when a cron expression fires, that run is skipped;
- there is no catch-up queue for missed runs;
- scheduled runs happen wherever the Docklands control plane runs, then dispatch
  to a remote runtime worker over SSH if the service is assigned to one.

:::note
Treat the cron frequency as your real recovery-point granularity, and check a
backup's run history periodically rather than assuming every scheduled run
happened.
:::
