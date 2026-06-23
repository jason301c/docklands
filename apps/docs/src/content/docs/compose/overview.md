---
title: Compose services
description: Deploy a multi-container Docker Compose stack as a single Docklands service, and choose when to use Compose versus an application or a managed database.
---

A **Compose service** runs a multi-container [Docker Compose](https://docs.docker.com/compose/)
stack as one service on your workspace canvas. Instead of Docklands building a
single container image for you, you bring a `compose.yaml` and Docklands runs it
with `docker compose` (or `docker stack`) on the runtime worker you place it on.

Use a Compose service when an app is naturally several containers that must run
together — for example an API plus a worker plus a database — and you want to
keep their wiring in one Compose file rather than splitting them into separate
Docklands services.

## Compose vs. application vs. managed database

Docklands gives you three ways to run something. Pick the one that matches how
the workload is shaped:

- **Application** — a single service Docklands builds and runs for you from a Git
  repo, a Dockerfile, a buildpack, or a prebuilt image. Choose this when one
  container is enough and you want Docklands to own the build.
- **Managed database** — one of the six built-in engines (PostgreSQL, MySQL,
  MariaDB, MongoDB, Redis, libSQL) that Docklands provisions, secures, connects,
  and backs up as a first-class service. Choose this for a standalone database.
  See [Databases](/databases/overview/).
- **Compose service** — a Compose file you supply, run verbatim. Choose this for
  multi-container stacks, or to deploy an upstream project's official Compose
  file unchanged.

:::tip
If a stack *contains* a database (Postgres, Redis, etc.) as one of its services,
you do not have to pull that database out into a managed database. Docklands
detects it and promotes it for connection info and backups automatically — see
[Databases embedded in a stack](/compose/embedded-databases/).
:::

## Compose source

A Compose service gets its `compose.yaml` from one of two kinds of source. The
source is stored on the service and can be changed later.

- **Raw** — you paste or edit the Compose file directly in Docklands. Nothing is
  cloned; the file you save is written to disk and deployed. Templates and
  imported Compose files use this mode.
- **Git** — Docklands clones a repository and uses a Compose file from it. The
  supported providers are GitHub, GitLab, Bitbucket, Gitea, and a generic Git URL
  (`git`). For Git sources you also set the branch and the path to the Compose
  file inside the repo.

For Git sources, Docklands can additionally apply local **patches** to the cloned
tree before deploying (the **Patches** tab), so you can adjust an upstream
Compose file without forking it. Patches are not available for raw sources,
because there is nothing cloned to patch.

## Compose type: Compose vs. Stack

A Compose service runs in one of two modes:

- **`docker-compose`** (default) — deployed with `docker compose -p <appName> up`.
- **`stack`** — deployed as a Docker Swarm stack with `docker stack`.

The mode is shown as a **Compose** or **Stack** badge on the service's General
tab. It affects how the service is started, stopped, and removed, and how
embedded-database container lookups resolve at backup time.

## Environment variables

A Compose service has its own environment, edited on the **Environment** tab.
These values are written to the service's `.env` so that `${VAR}` references in
the Compose file resolve at deploy time. When you deploy from a
[template](/compose/templates/), Docklands pre-fills this environment with the
generated values (passwords, domains, keys) it produced while processing the
template.

## Isolated deployment and randomization

Two related options help you run multiple copies of the same stack — or avoid
name collisions with other stacks — on the same runtime worker:

- **Randomize Compose** appends a suffix to volume, network, and service names so
  the stack does not collide with another deployment that uses the same names.
- **Isolated deployment** is a stronger form of the same idea used by templates:
  the whole stack is rewritten to run isolated from other stacks. Templates are
  deployed with isolated deployment enabled.

Both are managed from the service's **Advanced** tab.

## Deploy lifecycle

Deploying a Compose service runs through Docklands' deployment queue, the same
queue every service uses, partitioned per runtime worker:

1. You trigger a deploy (or redeploy/rebuild) from the service.
2. The job is queued. For a Git source, Docklands clones the repository (and
   applies any patches); for a raw source, it writes the Compose file to disk.
3. Docklands runs the build/up command for the stack on the target runtime
   worker — locally over the Docker socket, or remotely over SSH.
4. The service status moves through `idle` → `running` → `done` (or `error`),
   and build output streams to the **Deployments** tab logs.
5. On success or failure, Docklands sends the configured build notifications.

Other lifecycle actions available on the service:

- **Redeploy / Rebuild** re-runs the deploy without changing configuration.
- **Stop** brings the stack down (`docker compose stop`, or `docker stack rm` for
  a Swarm stack) and sets the status to `idle`.
- **Start** brings a `docker-compose` stack back up.
- **Cancel deployment** requests cancellation of an in-flight build and marks the
  service idle.
- **Delete** removes the stack, its deployments, and its on-disk project
  directory. You can choose whether to also delete volumes.

:::caution
**Stop and start are only fully symmetric for `docker-compose` services.** For a
Swarm `stack`, *Stop* removes the stack (`docker stack rm`), but the *Start*
action only brings up `docker-compose` services — there is no in-place "start"
for a removed stack. To bring a Swarm stack back, redeploy it.
:::

:::caution
Compose files are deployed essentially as written. Docklands runs your stack on
your own Docker Engine, so the containers, volumes, ports, and mounts the Compose
file declares are created on your machine with the privileges that file requests.
Review Compose files — especially from templates or third parties — before
deploying, the same way you would review anything you run with `docker compose`
directly.
:::
