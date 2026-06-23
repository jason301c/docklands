---
title: Docker resources and cleanup
description: Inspecting and managing the Docker images, volumes, and networks behind your services, and keeping disk usage in check on each worker.
---

Your services leave Docker resources behind on the host: container **images**,
**volumes** that hold their data, and the **networks** they attach to. Docklands
manages most of these for you as part of deploying, but it also gives you direct
visibility and cleanup controls so a long-lived host does not silently fill its
disk. Everything here runs against a specific worker, so use the runtime worker
filter to target the local host or a remote machine.

## Networks

Every service Docklands deploys attaches to the **`docklands-network`** overlay
network, created during worker setup. This shared overlay is what lets services
reach each other by name and lets the Traefik ingress runtime route to them.
Compose services with **isolated deployment** enabled get their own dedicated
network instead, created and wired up at deploy time.

You can see a container's networks from the **Container runtime** page — open a
container and view its **Networks**. You generally do not create networks by
hand; Docklands manages `docklands-network` and per-stack networks as part of the
deploy lifecycle.

## Volumes

Volumes hold the persistent data for your services — database files, uploaded
content, and anything you mount. A service's mounts are visible from its
container in the **Container runtime** view (**Mounts**), and you configure them
per service in the application's **Volumes** settings.

:::caution
**Volumes hold your data — deleting one is unrecoverable.** Docklands
deliberately treats volume cleanup as a manual, opt-in action and excludes
volumes from automatic cleanup, because a stopped (but still needed) container
can make its volume look unused. Never run a volume prune unless you are certain
nothing you care about depends on the volumes being removed. Back up first; see
[Backups](/databases/backups/) for databases and volume backups.
:::

## Images

Each build or image-based service pulls or produces a Docker image on the worker
that runs it. Over time, old and superseded images accumulate and consume disk.
Docklands can prune these, either on demand or on a schedule.

## Cleanup

Docklands wraps Docker's built-in prune commands. The available cleanup actions,
per worker, are:

| Action | What it runs | Removes |
| --- | --- | --- |
| Containers | `docker container prune` | stopped containers |
| Images | `docker image prune --all` | unused images |
| Builders | `docker builder prune --all` | build cache |
| System | `docker system prune --all` | everything reclaimable |
| Volumes | `docker volume prune --all` | unused volumes (manual only) |

### Scheduled cleanup

When you enable **Runtime Cleanup** on a worker (in the create/edit worker
dialog, or the Docker-cleanup toggle in its actions), Docklands schedules a daily
cron job on that worker that runs the cleanup automatically. This is the simplest
way to keep image and build-cache growth in check on a busy host.

:::note
**Scheduled cleanup never touches volumes.** The automatic "clean everything" job
deliberately excludes the volume prune, for the data-safety reason above. Volume
pruning is always something you trigger yourself, knowingly.
:::

You can also trigger a one-off cleanup from a worker's actions, and Docklands can
send a notification when a scheduled cleanup runs (configure providers under
Settings → Notifications).

### Picking what to prune

- For routine disk savings, **Images** and **Builders** are the safe, high-value
  targets — they reclaim the most space and never remove anything in use.
- **System** is the most aggressive non-volume option; it removes all unused
  images, stopped containers, and build cache in one pass.
- **Volumes** is the one to be careful with — read the caution above.

:::caution
Cleanup actions are powerful and run real `docker prune` commands on the target
host. They are gated behind permissions and only affect resources Docker
considers unused, but an aggressive system or volume prune on the wrong worker
can remove data a stopped service still needs. Confirm which worker is selected
in the runtime filter before pruning.
:::
