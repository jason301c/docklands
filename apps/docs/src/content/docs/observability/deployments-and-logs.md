---
title: Deployments & Logs
description: Deployment history, the worker queue, and live build and runtime logs across every service.
---

Every time Docklands builds and ships a service it records a **deployment**: a
row capturing the title, status, the on-disk path to its build log, and which
service and runtime worker it belongs to. This page explains where deployments
live, how the worker queue runs them, and how to read the logs they produce.

## Where deployments come from

A deployment is created whenever a service is deployed, redeployed, restarted,
or rebuilt — from the workspace canvas, a Git webhook, a backup run, or a preview
environment. Each record is tied to exactly one source: an application, a compose
stack, a preview deployment, a backup, or a volume backup. The build log is
written to a file on the machine that runs the build, and the deployment row
stores that `logPath` plus the process id (`pid`) while it is running.

A deployment moves through four states:

| Status | Meaning |
| --- | --- |
| `running` | The build/deploy process is active. |
| `done` | The deployment finished successfully. |
| `error` | The deployment failed or was killed. |
| `cancelled` | The deployment was stopped before completing. |

## The central deployments view

`/dashboard/deployments` is the organization-wide deployment surface. It has two
tabs:

- **History** — every deployment record across all workspaces and environments,
  with summary cards for active, successful, and failed counts plus the most
  recent activity. You can search by service, workspace, environment, or title,
  and filter by status or by service type (application vs. compose). The list
  refreshes every few seconds.
- **Worker queue** — the live state of the in-memory deployment queue (see
  below).

This view requires the **deployment: read** permission. Members who are scoped
to specific services only see deployments for the services they can access;
owners and admins see everything.

You can also see deployment history scoped to a single service from that
service's detail view in the workspace, and scoped to a runtime worker from the
worker's page.

:::note
The central history shows only **application and compose** deployments. Records
tied to backups or volume backups exist in the database and appear in their own
contexts, but they are not listed in the `/dashboard/deployments` History table.
:::

## The worker queue

Docklands runs deployments through an **in-memory FIFO queue** that lives inside
the control-plane process. It partitions work per runtime worker and serializes
jobs per service, so two deployments of the same service never run at once. The
queue is a process-global singleton — there is no Redis or external broker
backing it.

The **Worker queue** tab shows the jobs the worker currently knows about, with
their state (`pending`, `active`, `waiting`, `delayed`, `completed`, `failed`,
and so on), when each was added, processed, and finished, and any failure
reason. It refreshes every few seconds and links each job back to its service.

:::caution
Because the queue is in memory, **restarting the control plane clears it**. Jobs
that were queued but not yet started are lost on restart; deployments that were
mid-flight are not automatically resumed. The persisted `deployment` rows
remain, but the live queue starts empty.
:::

## Reading logs

Docklands surfaces two distinct kinds of logs.

### Build / deploy logs

While a service builds and deploys, its output is written to the deployment's
log file and streamed live into the UI. Open a deployment from a service's
detail view to watch it in real time; the stream follows the file as it grows
(`tail -f`) over a WebSocket and replays from the beginning so you see the whole
build.

For finished deployments you can also read the tail of the stored log file
on demand. This returns the last *N* lines (up to 10,000, default 100) of the
log, fetched from local disk or — for a deployment that ran on a remote runtime
worker — over SSH from that worker.

Build logs are kept as files on disk for as long as the deployment record
exists; removing a deployment deletes its log.

### Container / runtime logs

Separately from build logs, you can stream the **live logs of a running
container** (or Swarm service) from a service's detail view or from
`/dashboard/container-runtime`. These come straight from `docker logs --follow`
on the relevant runtime worker, with timestamps. You can:

- set how many lines of history to load (`tail`, up to 10,000),
- limit to a recent window (`since`, e.g. `5m`, `1h`, `2d`, or `all`), and
- filter with a plain-text search.

Container logs are streamed on demand and are not stored by Docklands — they
live only in the container's own log driver. Closing the view stops the stream.

:::caution
Log streaming over WebSockets checks that you are signed in, and container
log/stat/terminal streams additionally require the **docker: read** permission.
Build-log streaming, however, is gated only on a valid session plus a path check
— it does not re-verify per-service access. Treat anyone with a dashboard
account as able to read build-log output if they can discover a log path.
:::

## Stopping and removing deployments

From a running deployment you can **cancel** it, which kills the build process
(by `pid`, locally or over SSH on a remote worker) and marks the deployment
`error`. This requires the **deployment: cancel** permission. You can also
**remove** a deployment record, which deletes the row and its log file; this
also requires **deployment: cancel**.
