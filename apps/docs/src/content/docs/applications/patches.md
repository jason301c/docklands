---
title: Source patches
description: Overlay file edits onto a service's cloned repository at build time, without changing upstream.
---

**Source patches** let you change files in a service's source **at build time**
without modifying the upstream repository. Docklands applies your patches to the
freshly cloned code — *after clone, before build* — every time the service
deploys. This is useful for small, environment-specific tweaks (a config value, a
Dockerfile line, a one-off fix) you don't want to fork the repo for.

Patches are available for both [applications](/applications/overview/) and
[Compose](/compose/overview/) services that build from a Git source. You'll find
them on the service's **Patches** panel.

## How a patch works

Each patch targets a single file path within the repo and has a type:

| Type | Effect at build time |
|---|---|
| **Create** | Write a new file with your content. |
| **Update** | Replace the file's content with yours. |
| **Delete** | Remove the file if it exists. |

Patches are applied in the cloned `code/` directory before the build runs, so
the build (Dockerfile, Nixpacks, etc.) sees the patched files. The upstream
repository is never modified — pull a fresh clone and the patches simply re-apply
on the next deploy.

Only **enabled** patches are applied. Each patch has an on/off toggle, so you can
keep a patch defined but inactive.

## Create a patch

1. Open the service's **Patches** panel.
2. Browse the repository tree and open the file you want to change. (The first
   time, Docklands prepares a working clone of the repo so you can browse it.)
3. Edit the content and **save it as a patch** — or mark a file **for deletion**,
   or add a **new file** as a create patch.
4. **Deploy** the service. Docklands applies the enabled patches to the clone and
   builds from the result.

A file path is unique per service: saving the same path again updates the
existing patch rather than creating a second one.

:::caution[Patches re-apply on every deploy]
Because patches are reapplied to a fresh clone each build, they always reflect
your saved content — but they can also **silently conflict** with upstream
changes. If upstream restructures or renames the file you patched, an *update*
patch overwrites whatever is now there and a *delete* patch may target a path
that no longer exists. Revisit patches after large upstream changes.
:::

## Manage patches

- **Toggle** a patch to enable/disable it without deleting it.
- **Edit** a patch's content or change its type.
- **Delete** a patch to stop applying it.

Disabling or deleting a patch only affects future deploys — redeploy the service
for the change to take effect.

## Housekeeping

Docklands keeps a working clone of each patched repo on the runtime worker so the
file browser is fast. An administrator can clear these working clones from
**Settings → Runtime** (storage actions) if they accumulate; they're recreated on
demand the next time you browse a repo.
