---
title: The Workspace Canvas
description: How projects, environments, and the service canvas fit together in Docklands.
---

The **workspace canvas** is the primary surface in Docklands. It lives at
`/dashboard/workspace` and is where you create projects, lay services out
visually, wire them together, and manage their lifecycle — all on one canvas per
environment.

## The model: project → environment → service

Docklands organizes everything into three nested concepts.

- A **workspace** (also called a project) is the top-level boundary for a system
  you are running. It belongs to your organization, carries a name, an optional
  description, and a workspace-level set of environment variables shared by
  everything inside it.
- An **environment** is a slice of a workspace — typically `production`,
  `staging`, or a feature environment. Every workspace gets a default
  `production` environment automatically when it is created. An environment also
  has its own variables, layered on top of the workspace variables.
- A **service** is a single deployable unit inside an environment. Services come
  in three families: [applications](/applications/overview/) (deployed from Git,
  a Docker image, or a buildpack), [Compose stacks](/compose/overview/), and
  [managed databases](/databases/overview/) (PostgreSQL, MySQL, MariaDB, MongoDB,
  Redis, and libSQL).

```
Workspace  (your project, e.g. "Storefront")
└── Environment  (e.g. "production")
    ├── Application  (web)
    ├── Application  (worker)
    ├── Postgres     (managed database)
    └── Compose      (supporting stack)
```

Each environment has exactly one canvas. When you open a workspace you land on
one environment's canvas, and you switch environments from the selector in the
canvas header. See [Environments](/workspace/environments/) for creating,
switching, and duplicating them.

## What the canvas is for

The canvas is a spatial map of one environment. Every service is a **card**
(a node) you can drag around, and the lines between cards are **connections**
you draw to model private service-to-service links. From a card you can open the
service, deploy/start/stop it, edit its variables, and connect it to another
service.

The canvas stores **only layout and connection metadata** — where each card
sits, how big it is, and which services are linked. The services themselves, their
deployments, variables, domains, logs, and previews are the same underlying
records you would manage anywhere else in Docklands; the canvas is a view and a
control surface over them, not a separate copy.

:::note
Because the canvas is layout-only, deleting a connection or rearranging cards
never deletes or redeploys a service. Service lifecycle actions (deploy, start,
stop, remove) still go through the normal service machinery.
:::

## Getting to the canvas

- `/dashboard/workspace` — the **workspace overview**: a home dashboard with
  service/deployment counts, recent deployments, and recent workspaces. From
  here you create your first workspace.
- `/dashboard/workspace?view=workspaces` — the **list-view fallback** (see
  [Navigation](/workspace/navigation/)).
- `/dashboard/workspace/<workspaceId>/<environmentId>` — the **canvas** for one
  environment.

## Reading a service card

Each card shows the service name, its type, a status indicator, and how long ago
it was last deployed. Status is one of:

| Status | Meaning |
| --- | --- |
| `running` | The service is deployed and up. |
| `done` | The last deploy finished. |
| `error` | The last deploy or run failed. |
| `idle` | No active deployment. |

:::caution[Status is not live by default]
The canvas loads service status when you open it and refreshes after you take an
action (deploy, start, stop, connect, arrange). It does **not** poll in the
background, so a service that changes state on its own — for example a container
that crashes minutes later — will not update the card until you trigger a
refresh or reopen the canvas.
:::

## Where to go next

- [Environments](/workspace/environments/) — create, switch, duplicate, and the
  promotion story.
- [Services and connections](/workspace/services-and-connections/) — add
  services, place them, draw private links, and apply generated connection
  variables.
- [Topology](/workspace/topology/) — how the canvas groups connected services
  into stacks.
- [Navigation](/workspace/navigation/) — the command bar, search, and the
  list-view fallback.
