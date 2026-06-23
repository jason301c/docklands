---
title: Creating a Database
description: Add a managed PostgreSQL, MySQL, MariaDB, MongoDB, Redis, or libSQL service to a project environment.
---

You create a managed database from the project canvas at `/dashboard/workspace`.
Open the **add** menu for the environment and choose **Database**, then pick an
engine. (If you are adding a single-database template, Docklands opens this same
picker preset to the detected engine.)

## Choose an engine

Select one of the six engines — PostgreSQL, MySQL, MariaDB, MongoDB, Redis, or
libSQL. The form below the picker changes to show only the fields that engine
needs.

## Fill in the form

Common fields for every engine:

- **Name** — a human-readable label. As you type, Docklands suggests a matching
  **Service Name**.
- **Service Name** — the internal runtime service name. This is also the
  database's **internal host** that other services use to reach it (see
  [Connection variables](/databases/connection-variables/)). It may contain only letters,
  numbers, dots, underscores, and hyphens — no spaces. Docklands appends a short
  random suffix to keep it unique on the runtime.
- **Description** — optional free text.
- **Container image** — the Docker image to run. Leave it blank to use the
  engine's default (for example `postgres:18`), or pin a specific tag or registry
  path.
- **Database Password** — see [Passwords](#passwords) below.
- **Placement** — when you have more than one runtime worker, you can pin the
  database to a specific worker. Otherwise Docklands uses automatic placement.

Engine-specific fields:

- **PostgreSQL / MySQL / MariaDB** — **Database Name** and **Database User**.
- **MySQL / MariaDB** — an additional **Database Root password**.
- **MongoDB** — **Database User** and a **Use Replica Sets** toggle. Enabling
  replica sets makes Docklands run a startup script that initializes a
  single-member replica set (`rs0`) and creates the root user.
- **Redis** — password only. The user is always `default`.
- **libSQL** — **Database User**, **Sqld Node** (`primary` or `replica`), an
  optional **Sqld Primary URL** (required when the node is a `replica`), and an
  **Enable Namespaces** toggle.

## Passwords

The **Database Password** (and the MySQL/MariaDB **Root password**) must avoid
shell-dangerous characters. Allowed characters are letters, numbers, and the
symbols `@#%^&*()_+-=[]{}|;:,.<>?~`` `. Specifically avoid `$ ! ' " \ /` and
spaces — they break database compatibility and the shell commands Docklands runs
against the container.

:::tip
If you leave the password field empty, Docklands generates a strong password for
you (this also covers the MySQL/MariaDB root password). You can view it
afterwards under **Internal Credentials**, and change it later — see
[Change the password](/databases/managing/#change-the-password).
:::

## What happens on create

When you submit the form, Docklands:

1. Validates the engine-specific configuration and generates any missing
   passwords.
2. Creates the database record and registers it as a service in the environment.
3. Creates a named data volume (`<service-name>-data`) mounted at the engine's
   data path inside the container.

At this point the database **exists but is not running**. Nothing is pulled or
started until you provision it. Open the database and use **Provision** to
download the image and start the container — see
[Managing a database](/databases/managing/#provision-deploy).

:::caution
Creating the database does not deploy it. A freshly created database shows an
idle status until you provision it for the first time.
:::

## Editing details later

After creation you can edit the **Name**, **Description**, **Container image**,
and an optional **Command** override from the **Modify Database** dialog.
Changing the image or command takes effect on the next provision/deploy.

Credentials are **not** edited through this dialog — the database name, user, and
engine settings are fixed at creation, and the password is changed through the
dedicated [change-password](/databases/managing/#change-the-password) flow.
