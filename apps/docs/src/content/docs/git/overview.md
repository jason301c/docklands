---
title: Git Providers Overview
description: How Docklands deploys from Git — connected providers vs public Git URLs vs SSH deploy keys, and how automatic deploys on push work.
---

Most services in Docklands deploy from source control. This section covers how
you connect that source control: the **Git providers** you authorize once under
`/dashboard/settings/git-providers`, the **SSH keys** you manage under
`/dashboard/settings/ssh-keys`, and how a push to your repository turns into a
deploy.

Connecting a provider is an organization-level setting. Choosing *which*
repository and branch a given service deploys from happens per-service on the
workspace canvas — that side is documented in
[Application sources](/applications/sources/). This section is about the
connection itself.

## Three ways to deploy from Git

Docklands can reach your code three different ways, in decreasing order of
integration:

1. **A connected Git provider** — GitHub, GitLab, Bitbucket, or Gitea. You
   authorize Docklands against the provider once, and then any service can pick a
   repository and branch from a dropdown. This is the richest path: it unlocks
   repository and branch browsing, automatic deploys on push or tag, and (for
   GitHub) pull-request [preview deployments](/applications/preview-deployments/).
   See the per-provider pages: [GitHub](/git/github/), [GitLab](/git/gitlab/),
   [Bitbucket](/git/bitbucket/), [Gitea](/git/gitea/).

2. **A public Git URL** — the **Git** source type. You paste any clone URL with
   no provider account at all. For private repositories you attach an
   [SSH deploy key](/git/ssh-keys/). There is no provider webhook, so push-based
   auto-deploy is only available through the per-service refresh-token webhook
   (below).

3. **SSH deploy keys** — managed keys used both to clone private repos over an
   SSH URL and to reach [remote runtime workers](/git/ssh-keys/). See
   [SSH keys](/git/ssh-keys/).

If you only ever deploy public repositories, you do not need to connect a
provider at all — the **Git** source type is enough. Connect a provider when you
want repository browsing, automatic deploys, or previews.

## What a provider connection stores

Each connection is a row owned by the user who created it and scoped to the
active organization. Depending on the provider it holds an OAuth access/refresh
token, a GitHub App private key and webhook secret, or a Bitbucket API token.
These are the credentials Docklands uses to list repositories, read branches, and
clone code at deploy time, so treat the database (and its backups) as holding
real secrets.

A connection is private to its creator by default. The owner can **Share with
organization** to let every member select it when configuring a service. Owners
and admins can edit or delete any connection; members can only manage their own
or shared ones.

:::caution
Provider credentials are stored in the Docklands PostgreSQL database **as-is**,
not encrypted at rest by the application. Anyone with database or backup access
can read the GitHub App private keys, OAuth tokens, and Bitbucket API tokens.
Protect the database accordingly, and prefer scoping tokens to the minimum repos
and permissions you need.
:::

## How automatic deploys work

There are two distinct webhook paths, and they behave differently.

### Provider App webhook (GitHub App only)

When you install the GitHub App, Docklands registers **one** webhook on the App
itself, pointing at `/api/deploy/github`. GitHub signs every delivery with the
App's webhook secret, and Docklands verifies that signature before doing
anything. A verified `push` (or `pull_request`) event is matched against every
service that uses this GitHub connection with **Autobuild** on and a matching
owner/repository/branch, and each match is queued for deploy. Tag pushes deploy
services whose trigger type is `tag`. Commits whose message contains a skip
keyword (`[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`)
are ignored.

This means GitHub auto-deploy works for *all* your GitHub-sourced services from a
single signed webhook — you do not configure a webhook per repository.

### Per-service refresh-token webhook (all sources)

Every application and Compose service also has its own webhook URL containing a
secret **refresh token**:

```text
https://<your-docklands-host>/api/deploy/<refreshToken>
https://<your-docklands-host>/api/deploy/compose/<refreshToken>
```

You find it on the service's **Deployments** tab, with a copy button, and you can
regenerate the token if it leaks. Point a repository webhook (GitHub, GitLab,
Gitea, Bitbucket, or a CI system) at this URL and a push triggers a deploy —
provided **Autobuild** is on for the service and the pushed branch matches the
configured branch. This is the path GitLab, Gitea, and Bitbucket use for
auto-deploy, since Docklands does not create webhooks for those providers
automatically.

:::caution
The refresh-token webhook is authenticated **only** by the secret token in the
URL — there is no payload-signature check on this endpoint. Anyone who learns the
URL can trigger a deploy of the current branch. Keep it out of logs and public
places, and regenerate the token if you suspect it leaked. (The branch-match and
[watch-path](/applications/sources/) checks limit *what* deploys, but not *who*
can trigger it.)
:::

### Watch paths

For push events, if a service has **watch paths** configured, Docklands only
deploys when the push changed a file matching one of those globs. With no watch
paths set, every push to the branch deploys. Watch paths are evaluated from the
commit's modified-file list in the webhook payload.

## Provider capability summary

The four providers are not at full parity. This table reflects what is actually
wired today:

| Capability | GitHub | GitLab | Bitbucket | Gitea |
|---|---|---|---|---|
| Connect method | GitHub App (manifest) | OAuth app | Atlassian API token | OAuth2 app |
| Browse repos / branches | Yes | Yes | Yes | Yes |
| Auto-deploy webhook auto-registered | Yes (App webhook, signed) | No (use refresh-token URL) | No (use refresh-token URL) | No (use refresh-token URL) |
| Deploy on tag | Yes | Via refresh-token webhook | Via refresh-token webhook | Via refresh-token webhook |
| PR/MR preview deployments | Yes | No | No | No |
| Webhook signature verified | Yes (App webhook) | n/a (no provider webhook) | n/a | n/a |

Pick the provider page for the exact setup steps. If your provider is not listed,
or you would rather not authorize an app, use the [Git source](/applications/sources/)
with an [SSH key](/git/ssh-keys/) instead.
