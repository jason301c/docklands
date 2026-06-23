---
title: Image Registries
description: Connect Docker Hub, GHCR, or a private container registry so Docklands can pull base images and push the images it builds.
---

An **image registry** is a place Docklands authenticates to with Docker so it can
pull and push container images. You configure registry credentials once, then
attach a registry to an application to control where that app's built image is
pushed and where its image is pulled from at deploy time.

Registries are organization-wide. Manage them at
**Settings → Image Registry** (`/dashboard/settings/image-registry`).

## What a registry is used for

Docklands uses a saved registry in three distinct roles, all attached
per-application:

- **Deploy/pull registry** — the registry the running service authenticates
  against when Docker pulls the image. This is also where a freshly built image
  is pushed by default.
- **Build registry** — when an application builds on a remote build worker, the
  built image is pushed here so the deploy worker can pull it. Use this when
  builds and deploys happen on different machines.
- **Rollback registry** — where rollback images are stored so a previous version
  can be redeployed without rebuilding.

You pick which saved registry fills each role from the application's own
settings, not from this page. This page only stores the credentials.

:::note
A registry here is for **your application images** — Docker Hub, GitHub
Container Registry (GHCR), AWS ECR, GitLab Container Registry, a self-run
registry, and so on. It is unrelated to Git providers (GitHub/GitLab/Gitea),
which are configured separately under **Settings → Git Providers**.
:::

## Add a registry

1. Go to **Settings → Image Registry** and choose **Add Image Registry**.
2. Fill in the fields:

   - **Registry Name** — a label for this credential set inside Docklands.
   - **Username** — the registry username. Case is preserved exactly as typed
     (for example, AWS ECR requires the literal username `AWS`).
   - **Password** — the registry password or access token.
   - **Image Prefix** — an optional path prefix prepended to image names (for
     example a namespace or project path).
   - **Registry URL** — the registry **hostname only**, with no scheme and no
     path. Examples: `registry.example.com`, `ghcr.io`, `localhost:5000`,
     `aws_account_id.dkr.ecr.us-west-2.amazonaws.com`. Leave it blank to target
     the default Docker Hub registry.
   - **Runtime worker (optional)** — where the `docker login` runs. By default
     Docklands authenticates on the local runtime; pick a deploy or build worker
     to authenticate from that machine instead.

3. Use **Test Registry** to verify the credentials, then **Create**.

:::caution
The **Registry URL** must be a bare hostname (optionally `host:port`). Values
with `https://` or a trailing path are rejected. This is a security boundary:
the URL is passed to `docker login`, so only hostname-shaped input is allowed.
:::

### Testing

**Test Registry** runs a real `docker login` against the registry using the
credentials you entered (or, when editing without re-entering the password, the
stored credentials). A green toast means the login succeeded. If you selected a
runtime worker, the login is attempted on that worker over SSH.

## Editing and removing

When you edit a registry, leave **Password** blank to keep the existing one;
enter a new value only to rotate it. Saving re-runs `docker login` to confirm the
updated credentials still work.

Removing a registry runs `docker logout` for its host and deletes the stored
credentials. Applications that referenced the registry have their reference
cleared (set to none) rather than being deleted, so deploys that depended on it
will need a registry reassigned before they can push or pull again.

## How credentials are stored

Registry usernames, passwords, and URLs are stored in Docklands' PostgreSQL
database. The password is held in plain text in the database (it must be
replayable to `docker login` and to Docker's image-pull auth), so protect
database access accordingly. The API never returns the password to the browser:
list and detail views omit it, and the edit form requires you to re-enter a
password only when you want to change it.

:::note
Because Docklands is single-tenant software you run on your own VM, "organization
scoped" means scoped to your instance's organization. Every registry, and the
checks that confirm a registry belongs to your organization before it can be
read, updated, tested, or deleted, are still enforced server-side.
:::
