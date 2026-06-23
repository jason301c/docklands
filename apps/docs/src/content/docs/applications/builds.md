---
title: Build Types
description: Every way Docklands turns application source into a runnable image — Nixpacks, Dockerfile, Heroku and Paketo buildpacks, Railpack, and static sites.
---

For any source that is **code** (Git, public Git, or a dropped zip), Docklands
turns that code into a container image using a **build type**. You choose it on
the application's **General** tab under **Build Type** ("Select the way of
building your code"). Container Image sources skip this step — there is nothing to
build.

The available build types are **Nixpacks** (default), **Dockerfile**, **Heroku
Buildpacks**, **Paketo Buildpacks**, **Railpack**, and **Static**.

:::caution
Builders can consume significant memory and CPU (roughly 4+ GB RAM and 2+ CPU
cores for comfortable builds). On a small control-plane VM, heavy builds can fail
or starve running services. Offload them to a dedicated **build worker** — see
[Advanced settings](/applications/advanced/).
:::

## Nixpacks (default)

Nixpacks auto-detects your stack (Node, Python, Go, Rust, and many more) and
builds an image with no configuration. New applications default to Nixpacks
because it works for most projects out of the box and needs no extra tooling.

It receives your environment variables at build time. If you set a **Publish
Directory** under the Nixpacks options, Docklands runs the Nixpacks build, copies
that directory of build artifacts out of the resulting image, and re-wraps it as a
static site served by nginx — useful for frontends whose build step emits static
files.

**Use it when:** you want a zero-config build and your project follows common
conventions.

:::note[Builder versions: Railpack is pinned-and-configurable, Paketo is fixed]
The Railpack builder runs a pinned default version that you can override per app
from the **Railpack Version** field. The Paketo builder image is hard-pinned with
no version field, so Paketo builds always use the bundled builder image — there
is nothing to choose.
:::

## Dockerfile

The Dockerfile build runs `docker build` against a Dockerfile in your repo. It is
the most flexible option and gives you full control. Configurable fields:

- **Docker File** — path to the Dockerfile (defaults to `Dockerfile`).
- **Docker Context Path** — the build context directory (defaults to the
  Dockerfile's directory).
- **Docker Build Stage** — a target stage for multi-stage builds (passed as
  `--target`).

The Dockerfile build type is also the only one that uses **build-time arguments**
and **build-time secrets**, and the **Create Environment File** option — see
[Environment variables](/applications/environment-variables/).

**Use it when:** you have an existing Dockerfile, need multi-stage builds, or want
precise control over the build.

## Heroku Buildpacks

Builds with the Cloud Native Buildpacks `pack` CLI using the Heroku builder
image. You can set a **Heroku Version** (the builder tag) — it defaults to `24`.

**Use it when:** your app already targets Heroku buildpacks or you want Heroku's
opinionated build behavior.

## Paketo Buildpacks

Builds with the `pack` CLI using the Paketo "jammy full" builder. There are no
extra fields to configure.

**Use it when:** you want Cloud Native Buildpacks with broad language support and
no Dockerfile.

:::note
Both buildpack options require the `pack` CLI to be available on the build host.
Nixpacks and Dockerfile have fewer prerequisites, which is why Nixpacks is the
default.
:::

## Railpack

Railpack builds with BuildKit using the Railpack frontend. You select a **Railpack
Version** from a dropdown (or enter a custom one); the default is a recent pinned
version. Each build runs in an isolated BuildKit builder instance so concurrent
builds do not collide.

**Use it when:** you want Railpack's build pipeline. It is a newer option,
flagged "New" in the UI.

## Static

The Static build serves a directory of prebuilt files with nginx. Set a **Publish
Directory** (the folder to serve) and, for client-side-routed apps, enable
**Single Page Application (SPA)** so unmatched paths fall back to `index.html`.

**Use it when:** your repo already contains static output (HTML/CSS/JS) and you
just need to serve it. If your static files come from a build step, use Nixpacks
with a Publish Directory instead, which builds first and then serves the result.

:::caution
The standalone Static build type currently generates a non-functional nginx
configuration for the SPA case (an invalid directive in the generated
`nginx.conf`), so the SPA fallback may not start as written. If you need a static
SPA today, the more reliable path is **Nixpacks with a Publish Directory**, which
produces the static image through the same code path but is exercised by the
default build flow. This is a known limitation; see your operator/release notes.
:::

## Build cache

The **Clean Cache** toggle on the General tab forces a no-cache build (it maps to
the underlying builder's cache-busting flag). Leave it off for fast incremental
builds; turn it on when a stale cache is causing wrong output.

## Where the image goes

By default the built image stays on the runtime worker that built it. If you
attach an **image registry** (in [Advanced settings](/applications/advanced/)),
Docklands pushes the image there after building — required when you build on a
separate build worker, and the foundation for [rollbacks](/applications/rollbacks/).
