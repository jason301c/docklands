---
title: Managing a Database
description: Provision, start, stop, reload, rebuild, change the password, and read logs for a managed database.
---

Once a database exists, you operate it from its detail view in the workspace. The
controls live on the **Runtime Setup** card, with credentials and other settings
in the cards below. The deployment and lifecycle actions require the
**deployment: create** permission; you will only see them if your role allows it.

## Provision (deploy)

**Provision** is the first deploy. It pulls the container image and starts the
database as a runtime service, streaming the logs into a drawer as it goes. Use
it the first time you bring a database online, and again after you change the
image or command.

Under the hood, provisioning pulls the image, builds the Swarm service from the
engine descriptor (environment, container command, ports, mount), and marks the
database **done** when the container is up. If it fails, the status becomes
**error** and the log drawer shows why.

## Start and stop

- **Stop** stops the running container without removing its configuration or
  data. The status becomes idle.
- **Start** brings a stopped database back up. It requires a previous successful
  provision — start does not pull the image or (re)create the service, it just
  starts the existing one.

## Reload

**Reload** restarts the database service without rebuilding it — a stop followed
by a start. Use it to bounce the container (for example after a configuration
change that only needs a restart). Data and configuration are untouched.

## Rebuild

**Rebuild** is destructive to data. It removes the runtime service, then
**deletes the database's data volumes**, and redeploys from scratch. Use it only
when you want a clean, empty database.

:::danger
Rebuild deletes the database's data volume. Everything stored in the database is
permanently lost. Take a [backup](/databases/backups/) first if you need the data.
:::

## Change the password

Open **Internal Credentials** and use the password control to set a new password.
Docklands runs the engine's password-change command inside the running container
and updates the stored credential in the same step, so the two stay in sync.

The new password must follow the same rules as on creation: no `$ ! ' " \ /` or
spaces (allowed: letters, numbers, and `@#%^&*()_+-=[]{}|;:,.<>?~`` `).

A few engine specifics:

- **PostgreSQL / MySQL / MariaDB / MongoDB / Redis** support changing the
  password in place.
- **libSQL does not support password changes** — its auth is baked into the
  container's environment at deploy time. The attempt fails with a "not
  supported" message.

:::caution
Changing the password updates the stored credential immediately, but **already
applied [connection variables](/databases/connection-variables/) on other services are not
rewritten**. After a password change, reapply each connection (or redeploy the
connected service) so it picks up the new password, or those services will fail
to authenticate.
:::

:::note
The database container must be running for a password change to succeed —
Docklands needs a live container to run the command against. If no running
container is found, the change fails.
:::

## Read logs

The detail view streams the container's logs. You can filter by:

- **Tail** — how many recent lines to read.
- **Since** — a time window such as `5m`, `2h`, `1d`, or `all`.
- **Search** — a plain-text filter (letters, numbers, spaces, and `. _ -`).

For databases on a remote runtime worker, logs are read from that worker.

## Open a terminal

**Open Terminal** attaches an interactive shell to the running database
container — useful for running the engine's own CLI (`psql`, `mysql`, `mongosh`,
`redis-cli`) against the live database.

## Custom command and arguments

Under the database's advanced settings you can override the container's
**command** and **arguments**. Most engines pass these through to the container;
a few wrap them so their built-in launch behavior still applies:

- **Redis** launches with `--requirepass` using your password unless you provide
  a command.
- **MongoDB** with replica sets enabled runs a startup script that initializes
  the replica set; a custom command runs after it.
- **libSQL** wraps your command (or the default `sqld` launch) and appends
  `--enable-namespaces` when that option is on.

Changes to the command or image take effect on the next provision/deploy.

## Move and delete

- **Move** transfers the database to a different environment.
- **Delete** removes the runtime service and the database record. This is
  permanent and includes the container; take a [backup](/databases/backups/) first if you
  need the data.
