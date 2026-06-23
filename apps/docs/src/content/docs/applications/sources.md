---
title: Application Sources
description: Choose where an application's code or image comes from — a connected Git provider, a public Git URL, a container image, or an uploaded zip.
---

A **source** tells Docklands where to get the thing it deploys. You pick one on
the application's **General** tab, under **Provider** ("Select the source of your
code"). The source type determines the rest of the build: code sources run a
[build](/applications/builds/); a container image source skips building entirely.

Docklands supports these source types:

- **GitHub**, **GitLab**, **Bitbucket**, **Gitea** — repositories from a
  connected Git provider.
- **Git** — any public (or SSH-key-reachable) Git URL, with no provider account.
- **Container Image** — a prebuilt image from a registry.
- **Drop** — a zip of code you upload directly.

## Connected Git providers (GitHub / GitLab / Bitbucket / Gitea)

These are the richest sources. They unlock automatic deploys on push, build-status
context, and [preview deployments](/applications/preview-deployments/) for pull
requests.

To use one you must first connect the provider account under
`/dashboard/settings/git-providers`. Until then, the provider's tab shows:

> To build from GitHub, you need to configure your account first. Please, go to
> Settings to do so.

Once connected, you select:

- **Repository** and **Owner** — the repo to deploy.
- **Branch** — the branch to build (validated as a real branch name).
- **Build Path** — the subdirectory within the repo to build from (defaults to
  `/`).
- **Watch Paths** — optional path globs; with watch paths set, a push only
  triggers a deploy if it touched a matching path.
- **Enable Submodules** — clone Git submodules when checking out.

GitHub additionally supports a **Trigger Type** of `push` or `tag`, so you can
deploy on tag pushes instead of branch pushes.

### Automatic deploys

When **Autobuild** is on (toggle on the General tab), a push to the configured
branch deploys automatically via the provider webhook. Docklands wires the webhook
when you connect the repo. You can also trigger a deploy from outside any provider
using the per-application webhook URL shown on the **Deployments** tab — it embeds
a rotating refresh token you can regenerate if it leaks.

:::note
Connecting and reconfiguring a Git provider is permission-gated. If you lose
access to the underlying provider connection, the application still shows its
configuration but flags that you can no longer edit or deploy its Git source.
:::

## Public Git URL ("Git")

The **Git** source deploys any repository by URL, without a provider account.
Configure:

- **Repository URL** — e.g. `https://github.com/you/repo.git` or an SSH URL.
- **Branch** — the branch to build.
- **Build Path** — subdirectory to build from.
- **SSH Key** — optional; select a key from `/dashboard/settings/ssh-keys` to
  clone a private repo over SSH.
- **Watch Paths** and **Enable Submodules** — as above.

Use this for repos on hosts you have not connected as a provider, or for private
repos you reach with an SSH deploy key. Because there is no provider webhook,
push-based auto-deploy and PR previews are not available for this source — deploy
manually or via the refresh-token webhook.

## Container Image

The **Container Image** source skips building and runs a prebuilt image. Configure:

- **Container Image** — the image reference, e.g. `node:16` or
  `ghcr.io/you/app:1.2.3`.
- **Registry URL** — optional; the registry host for a private image.
- **Username** / **Password** — optional registry credentials.

When you deploy, Docklands pulls this image and creates the Swarm service from it
directly. The [build type](/applications/builds/) selector is hidden for image
sources because there is nothing to build.

:::tip
For private images, prefer storing credentials once as an image registry under
`/dashboard/settings/image-registry` and selecting it in
[Advanced settings](/applications/advanced/), rather than typing a username and
password into each application.
:::

:::caution
The image reference must be valid and pullable from the runtime worker that will
run it. If no image is set, the deploy fails — there is no fallback image.
:::

## Drop (zip upload)

The **Drop** source lets you deploy a zip of code straight from your machine,
without Git. On the provider form you upload a **zip file** and optionally set a
**Build Path** (a subdirectory inside the archive to build from). Uploading
triggers a deploy immediately.

Docklands extracts the archive into the application's build directory and then
builds it with your selected [build type](/applications/builds/) — so a dropped
zip still needs a build type that matches its contents (for example Nixpacks for a
Node project, or Dockerfile if the zip contains one).

The extractor is defensive: it strips macOS metadata, unwraps a single top-level
folder if the zip has one, rejects path-traversal entries, and refuses symlinks
and device/FIFO nodes. Even so, only upload archives you trust.

:::tip
Drop is handy for one-off deploys, air-gapped workflows, or pushing a local
working copy without committing. For anything you iterate on, a Git source is more
convenient.
:::

## Switching sources

You can change an application's source at any time from the Provider form;
Docklands resets the previous source's fields. You can also fully disconnect the
Git provider, which clears all provider fields and returns the source to its
default. Switching source does not delete the running container — it takes effect
on your next deploy.
