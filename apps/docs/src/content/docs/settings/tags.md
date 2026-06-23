---
title: Tags
description: Create colored tags to label and filter your projects on the workspace overview.
---

Tags are short, colored labels you attach to projects to organize and filter
them. They are purely organizational metadata — tagging a project does not change
how it deploys or behaves.

Manage tags at **Settings → Tags** (`/dashboard/settings/tags`). Tags are
organization-wide and can be reused across as many projects as you like.

:::note
Tags attach to **projects** (workspaces), not to individual services. Use them to
group related projects on the workspace overview; service-level organization is
done on the workspace canvas itself.
:::

## Create a tag

1. Go to **Settings → Tags** and choose to add a tag.
2. Enter a **name** and pick a **color**.
3. Save.

Tag names must be unique within your organization — Docklands rejects a second
tag with the same name.

## Assign tags to a project

You assign tags from the project itself, not from this page. When you create or
edit a project (workspace), pick one or more tags in its tag selector. Saving
replaces the project's tag set with your selection, so it is the full list of
tags for that project each time.

Once assigned, tags appear as colored badges on the project and can be used to
filter the project list on the workspace overview.

## Edit or delete a tag

From **Settings → Tags** you can rename a tag, change its color, or delete it.

Deleting a tag removes it from every project it was assigned to (the
project-to-tag links are cleaned up automatically); the projects themselves are
untouched. There is no separate "remove from one project" step on this page —
adjust an individual project's tags from that project's editor.
