---
title: Preview Deployments
description: Spin up an isolated runtime for each pull request so changes can be reviewed before they reach production.
---

**Preview deployments** give each pull request its own isolated runtime of your
application, so reviewers can click a link and try the change before it merges.
When a PR is opened against a connected Git provider, Docklands builds the PR's
branch as a separate, short-lived application instance with its own URL.

Previews currently require a **GitHub App** source. They are driven by GitHub pull
request webhooks and status/comment APIs. GitLab, Gitea, and Bitbucket sources do
not support preview deployments in v0.1.0; they can still deploy through their
normal branch source and per-service refresh-token webhook URL.

## Enabling and configuring

Previews are off by default. You turn them on and configure them from the
**Previews** tab via the **Configure** action. The settings that govern previews
include:

- **Active** — the master switch that enables PR previews for this application.
- **Preview limit** — the maximum number of concurrent preview environments
  (defaults to a small number) so a flood of PRs cannot exhaust your host.
- **Preview port** — the container port previews expose (defaults to `3000`).
- **Wildcard / domain settings** — the hostname pattern previews are published
  under, plus HTTPS, path, and certificate options (Let's Encrypt, custom, or
  none).
- **Preview environment variables**, **build args**, **build secrets**, and
  **labels** — values applied to preview builds specifically, separate from your
  production settings.
- **Require collaborator permissions** — when on (the default), only PRs from
  users with repository collaborator access trigger previews.

:::caution
**Require collaborator permissions** is on by default for a reason: without it, a
pull request from any outside contributor could trigger a build and run code on
your infrastructure. Leave it enabled unless you fully trust every source of PRs to
the repo.
:::

## Working with previews

Once enabled, each qualifying pull request appears on the **Previews** tab as a
card showing the PR title, branch, status, and a **deployment URL**. From a preview
card you can:

- Open the preview URL.
- **View logs** for the preview's build and runtime.
- **Rebuild** the preview to pick up new commits.
- **Delete** the preview to tear it down.

Previews are meant to be disposable: they have an expiry and are cleaned up so they
do not accumulate. A preview's URL and runtime are independent of your production
instance, so testing a PR never touches the live application.

:::note
Each preview is a real build and a real running container. Keep the **preview
limit** sane for your host, and remember previews consume the same build resources
as a normal deploy.
:::
