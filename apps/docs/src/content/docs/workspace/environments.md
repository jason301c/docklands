---
title: Environments
description: Create, switch, and duplicate environments inside a workspace.
---

An **environment** is a slice of a workspace with its own service canvas and its
own variables. A typical workspace has a `production` environment plus one or
more others such as `staging`. Each environment is fully isolated: its services,
layout, connections, and variables are separate from every other environment in
the same workspace.

## The default production environment

When you create a workspace, Docklands automatically creates a default
environment named **`production`** and marks it as the default. This environment
is special:

- It **cannot be renamed.**
- It **cannot be deleted.**
- It is the environment the canvas opens to, and the one the command bar and
  overview links point at by default.

You never have to create the first environment — it always exists.

## Creating an environment

Use the environment selector in the canvas header to add another environment to
the current workspace. You provide:

- a **name** (required), and
- an optional **description**.

:::caution[The name "production" is reserved]
You cannot create a second environment named `production`. The reserved name
belongs to the auto-created default environment.
:::

Creating an environment requires the `environment: create` permission.

## Switching environments

The environment selector in the canvas header lists every environment in the
current workspace. Selecting one navigates to that environment's canvas
(`/dashboard/workspace/<workspaceId>/<environmentId>`). Each environment keeps
its own card layout and connections, so switching is instant and lossless.

## Environment variables

Variables resolve in layers. An environment carries its own variable block, and
it inherits the **workspace-level** variables that apply to every environment in
the project. Service-level variables (edited per service) layer on top of both.

Editing environment variables requires the `environmentEnvVars: write`
permission; editing workspace variables requires `workspaceEnvVars: write`.

See [Services and connections](/workspace/services-and-connections/) for how
generated database connection variables get written into a service's own
variable block.

## Duplicating an environment

You can duplicate an environment to clone its setup. A duplicate copies the
environment's name, description, and variable block into a new environment in the
same workspace.

:::caution[Duplicating an environment does not copy its services]
The `duplicate` action on an environment copies the environment record and its
variables — **not** the services inside it, and not the canvas layout or
connections. To clone services as well, use the workspace-level **duplicate**
flow, which can copy selected services (applications, Compose stacks, and managed
databases, along with their domains, ports, mounts, redirects, security rules,
and previews) into a new or existing project. Choose services explicitly when you
want a populated copy.
:::

## Deleting an environment

You can delete any non-default environment, but only when it is **empty**.

- The default `production` environment can never be deleted.
- An environment that still contains any application, Compose stack, or managed
  database is refused with an error — delete its services first.

Deleting an environment requires the `environment: delete` permission, and it
cascades: the environment's stored canvas layout and connection metadata are
removed with it.

## The promotion gap

Docklands does not have a built-in "promote environment X to production" action
that diffs and applies one environment's state onto another. Moving a setup
between environments today means **duplicating** (workspace-level duplicate into
the target project/environment, optionally including services) and then deploying
there. Plan environment workflows around duplication rather than an automated
promote-and-sync pipeline.
