---
title: Automations & scheduled tasks
description: Cron-style jobs that run commands inside services or scripts on the host and runtime workers.
---

An **automation** (internally, a *schedule*) is a cron job Docklands runs for
you. The same scheduling engine powers [backups](/backups/overview/), but
automations are general-purpose: run a command inside a service's container, or
run a shell script on the Docklands host or a remote runtime worker.

Host- and worker-level automations live at **Automations**
(`/dashboard/automations`). Service-level automations live on the **Schedules**
section of an individual application or compose service.

## Schedule types

| Type | Runs | Where it's managed | What it executes |
| --- | --- | --- | --- |
| `application` | A command inside a running application container | The application's Schedules section | `docker exec` of your command with `bash`/`sh` |
| `compose` | A command inside a chosen compose service's container | The compose service's Schedules section | `docker exec` of your command |
| `runtimeWorker` | A script on a remote runtime worker | Automations (with a worker selected) | A `script.sh` written to the worker |
| `docklands-server` | A script on the Docklands host | Automations | A `script.sh` written to the host |

`runtimeWorker` and `docklands-server` automations run **shell scripts on the
machine itself**, outside any container. Because that is host-level access, only
**owners and admins** can create, edit, run, or even list them. Application and
compose automations are gated by the normal per-service `schedule` permission.

## Create an automation

Each automation has:

- **Name** and optional **description**.
- **Cron expression** — when it runs. The form offers common presets (every 15
  minutes, daily, weekly, etc.) plus a custom field.
- **Timezone** — the cron expression is evaluated in this timezone, defaulting to
  **UTC**.
- For `application` / `compose`: a **command** and a **shell** (`bash` or `sh`).
  Compose schedules also require the **service name** to target.
- For `runtimeWorker` / `docklands-server`: a **script** (its body is run as
  `script.sh`).
- **Enabled** — toggle the schedule on or off without deleting it.

## How automations run

- **Application / compose:** Docklands finds the service's running container and
  runs `docker exec <container> <shell> -c "<your command>"`, streaming output to
  a deployment log you can open from the schedule's history.
- **Host / runtime worker:** Docklands writes your script to a `script.sh` in its
  schedules directory (on the host, or pushed to the worker over SSH) and executes
  it. A `PID: …` line is prepended automatically so the run can be tracked.

Every run records a deployment entry with status (done/error) and a captured log.
Use **run now** to execute an automation immediately, independent of its cron
schedule.

:::caution
Automation commands and scripts run **with the privileges of the Docklands
runtime** — for host and worker automations, that is direct shell access to the
machine, and application/compose commands run inside your containers. Anyone who
can create an automation can run arbitrary code there. This is why host- and
worker-level automations are restricted to owners and admins; keep that
restriction in mind when granting the `schedule` permission, and treat automation
bodies as trusted code.
:::

## Reliability and restarts

The scheduler runs **in-process** inside Docklands (using `node-schedule`), not as
a separate daemon. A few consequences worth knowing:

- **Schedules survive restarts.** On startup Docklands reloads every enabled
  backup and rebuilds its jobs from the database, so a restart does not silently
  drop them. (Standalone automations are similarly re-registered.)
- **Missed runs are not made up.** If Docklands is down at the moment a cron fires,
  that occurrence is skipped — there is no catch-up queue. A backup scheduled for
  03:00 while the host was offline simply does not run that night.
- **Jobs run on the single control-plane process.** There is no distributed
  scheduler or external queue; the job runs wherever Docklands runs (then shells
  out to the relevant host or worker). For services on runtime workers, the
  command is dispatched over SSH from the control plane.

:::note
Because runs are skipped (not deferred) when the host is down, treat the cron
**frequency** as your real recovery-point granularity, and check a backup's run
history periodically rather than assuming every scheduled run happened.
:::
