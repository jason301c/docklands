---
title: Rollbacks
description: Restore a previous image of an application from a registry when a deploy goes wrong.
---

**Rollbacks** let you restore an application to a previously deployed image. When
rollbacks are enabled, Docklands tags and pushes each successful build to a
registry as a versioned image; if a later deploy misbehaves, you restore one of
those saved versions and the running service is updated back to it.

## Requirements

Rollbacks are not on by default and have two prerequisites:

1. A **rollback registry** must be configured for the application — rollback
   images are stored there, not on the local worker.
2. The application's **rollback** option must be **active**.

You enable and configure rollbacks from the **Deployments** tab via the rollback
settings (the gear/"Configure Rollbacks" action). With both in place, every
successful deploy creates a new rollback entry: Docklands snapshots the
application's full deploy context (image tag, environment, mounts, ports, resource
settings, and registry) and pushes the image to the rollback registry tagged as
`appName:vN`, where `N` increments per version.

## Rolling back

Saved versions appear alongside your deployment history. To roll back you pick a
version and confirm; Docklands logs into the rollback registry, pulls the saved
image, and updates the Swarm service to run it using the snapshotted context (env,
mounts, ports, resources). The service is updated in place — it does not rebuild.

You can also delete a rollback entry you no longer need, which removes the stored
image from the worker.

:::caution
Because each version is a full image pushed to a registry, rollbacks consume
registry storage that grows with every deploy. Keep an eye on the rollback
registry and prune versions you will not need.
:::

:::note
A rollback restores the **image and its captured context**, not your source. After
rolling back, your Git source and current settings are unchanged — your next
**Run Build** will build from the current source again. Treat a rollback as an
emergency restore, then fix forward.
:::
