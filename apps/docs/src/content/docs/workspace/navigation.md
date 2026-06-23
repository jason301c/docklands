---
title: Navigation
description: The command bar, global search, and the list-view fallback.
---

Docklands gives you two fast ways to move around — a global **search command**
available everywhere, and a **canvas command bar** scoped to the environment
you are looking at — plus a **list-view fallback** for the workspaces that suits
bulk, table-style work.

## Global search command

Press `⌘K` (macOS) or `Ctrl+K` (Windows/Linux) anywhere in the dashboard to open
the global search palette. (`⌘J` / `Ctrl+J` opens it too.) Start typing to filter
across:

- **Workspaces** — jump to a workspace's default environment canvas.
- **Services** — every application, Compose stack, and managed database across
  all your workspaces and environments, shown with a live status dot. Selecting
  one opens that service.
- **Application** — top-level destinations: the workspace overview, the
  workspaces list, deployments, automations, host metrics, ingress files,
  container runtime, cluster runtime, and the settings surfaces (ingress,
  runtime workers, image registry, storage, build workers).

The palette only lists workspaces and services you have access to.

## The canvas command bar

When you are on an environment canvas, `⌘K` / `Ctrl+K` opens a **canvas-scoped
command bar** instead of the global palette — the canvas "owns" `⌘K` while you
are on it. (`⌘J` still opens the global search.) The canvas command bar is the
primary way to act on the current environment without hunting through the UI. It
groups commands roughly as:

- **Create** — new application, new database (and each specific engine), new
  Compose stack, create from template, import Compose.
- **Services** — for each service: open it, deploy, start, stop, edit variables,
  and jump to its deployment history, domains, previews, automations, or backups.
  You can also start a **connection** from a service or open its connections
  here.
- **Actions** — arrange the workspace (reset card layout), show/hide the topology
  panel, and select a topology stack.
- **System** — jump to ingress, runtime workers, git providers, image registry,
  SSH keys, and notifications.

Type to filter; the bar matches your query against each command's label,
description, and keywords. Press `Escape` to close it (which also cancels an
in-progress connection and closes any open dialogs).

## The list-view fallback

The canvas is the primary surface, but a **list view** of your workspaces remains
available as a fallback — useful for scanning many projects at once or for
table-style bulk operations that have not moved onto the canvas yet.

Reach it at `/dashboard/workspace?view=workspaces`, or via "Manage workspaces" /
"Workspaces" links from the overview and the global search. The same
`/dashboard/workspace` route shows the **overview dashboard** by default and
switches to the list only when `?view=workspaces` is present.

:::note[Canvas and list show the same data]
The list view and the canvas are two presentations of the same workspaces,
environments, and services — not separate stores. A service you create on the
canvas appears in the list and vice versa. The list does not show canvas-only
metadata (card positions or connections); for those, open the environment's
canvas.
:::

## Tags

Workspaces can carry **tags** (named, optionally colored labels scoped to your
organization) for organizing and filtering the workspaces list. Tags are managed
under [Settings → Tags](/settings/tags/) and assigned to workspaces; they are a
property of the workspace, not of individual services or canvas cards.
