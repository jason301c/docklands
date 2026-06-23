---
title: Metrics
description: Host and per-service resource metrics — CPU, memory, disk, network, and block I/O — collected from Docker stats on your own VM.
---

Docklands shows live resource usage for the host machine and for individual
services: CPU, memory, disk, network, and block I/O. Metrics are collected on
your own VM from Docker and the host OS — there is no external metrics service in
the default setup.

## Host metrics

`/dashboard/host-metrics` shows usage for the Docklands host itself. Viewing it
requires the **monitoring: read** permission.

The host view reads system stats directly from the operating system: CPU usage,
memory used vs. total, disk space and disk usage, network throughput, and block
(disk) I/O. While the page is open it samples these continuously and renders
them as live meters and time-series charts.

## Per-service metrics

Each application, compose stack, and managed database has a **Metrics** tab in
its detail view (also gated on **monitoring: read**). It shows the same five
dimensions — CPU, memory, block I/O, network I/O, and (for the host)
disk — scoped to that service's containers.

## How metrics are collected and stored

Metrics in the default ("free") path are sampled **only while you are watching
them**. When you open a metrics view, the browser opens a WebSocket to the
control plane, which then:

1. resolves the running container(s) for that service (by Swarm service label,
   Swarm task name, or compose container name),
2. runs `docker stats --no-stream` for the container roughly once per second
   (for the host, it reads OS-level stats instead), and
3. parses the result into CPU / memory / disk / network / block values, appends
   each to a small JSON file on disk, and streams the latest sample back to the
   browser.

The on-disk history is intentionally small: each metric file keeps at most **288
samples** and drops the oldest beyond that. Because samples are only taken while
a metrics view is open, the stored history is **not a continuous record** — it
reflects the times someone was actively looking at that service's metrics, not
the service's whole lifetime.

:::note
There is **no background collector**. If nobody has the metrics view open,
nothing is being recorded. Closing the page stops sampling for that service. The
host (`docklands`) is sampled the same way — only while the host-metrics page is
open.
:::

:::caution[Don't read stored history as a complete time series]
Because sampling happens only while a live stats stream is open, the stored
history is sparse: it captures the moments people were actively looking, not
continuous usage. Gaps in the charts mean nobody was watching then, not that the
service was idle — do not use this data for capacity planning or to reconstruct a
full timeline of resource usage.
:::

The metric files live under the runtime monitoring directory (`.docker/` paths
in development, `/etc/docklands` paths in production). They are plain JSON and
small by design, so they do not grow unbounded.

### Resetting stored metrics

An admin can clear all stored metric files from settings ("clean monitoring"),
which recreates the monitoring directory empty. This is the way to discard
accumulated samples.

## Remote runtime-worker metrics (advanced)

The metrics UI also contains a second, optional path that reads from a
Prometheus-style metrics endpoint exposed by a remote runtime worker (a separate
agent that scrapes container metrics and serves them over HTTP with a bearer
token). This is the more detailed, agent-backed monitoring inherited from
upstream.

:::caution
In the current build this remote/"paid" metrics source is **not wired into the
default experience** — the toggle that would switch to it is commented out, so
`/dashboard/host-metrics` always shows the on-demand Docker-stats path described
above. The remote metrics procedures and UI exist in the codebase but require a
configured external metrics agent and are not part of the standard self-hosted
flow.
:::
