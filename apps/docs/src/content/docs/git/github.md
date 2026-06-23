---
title: GitHub
description: Connect GitHub to Docklands by creating and installing a GitHub App, then deploy repositories with signed-webhook auto-deploy and PR previews.
---

GitHub is the most fully integrated provider. You connect it by creating a
**GitHub App** owned by your account or organization and installing it on the
repositories you want to deploy. Docklands then uses the App to list repos, read
branches, clone code, post pull-request comments, and receive a single signed
deploy webhook.

Connect GitHub under **Settings → Git Providers** (`/dashboard/settings/git-providers`).

## Create the GitHub App

1. On the Git Providers page, click **Github**.
2. In the dialog, leave **Organization?** off to create the App under your
   personal account, or turn it on and enter the **organization name** to create
   it under a GitHub organization.
3. Click **Create GitHub App**.

Docklands submits a **GitHub App manifest** to GitHub — it does not ask you to
fill in App settings by hand. The manifest pre-fills everything: the App's name
(`Docklands-<date>-<random>`), its URLs, the deploy webhook, the OAuth callback,
and the permissions and events it needs. You are taken to GitHub to confirm
creation.

The manifest requests these **repository permissions** and **events**:

- Permissions: `contents: read`, `metadata: read`, `emails: read`,
  `pull_requests: write`.
- Events: `push`, `pull_request`.

The `pull_requests: write` permission is what lets Docklands comment on PRs for
[preview deployments](/applications/preview-deployments/). `contents: read` is
used to clone your code.

When you confirm, GitHub redirects back to `/api/providers/github/setup`, and
Docklands exchanges the manifest code for the App's credentials (App ID, client
ID/secret, **webhook secret**, and **private key**) and stores them. The new
provider appears in the list.

:::note
The App's webhook URL and OAuth callback are derived from the URL in your
browser's address bar at the moment you create the App (its protocol and host).
Create the App while visiting Docklands on the **public hostname** you will
actually use — if you set it up over `http://localhost:3000` or an internal IP,
GitHub will not be able to reach the webhook and auto-deploy will silently never
fire. You would have to recreate the App from the correct host.
:::

## Install the App on your repositories

Creating the App is not enough — GitHub Apps only see repositories they are
**installed** on.

After creation, the provider row shows an **Action Required** badge with an
install link. Click it to open GitHub's installation flow and choose **All
repositories** or a specific set. When you finish, GitHub returns to Docklands
and records the **installation ID**, which flips the provider to configured.

A GitHub connection is only usable once it has an App ID, a private key, **and**
an installation ID. Until all three are present, it will not appear as an option
when configuring a service.

## Use it on a service

On a service's **General → Provider** tab, choose **Github**, then pick the
account (if you connected more than one), the **repository**, the **branch**, and
optionally a **build path**, **watch paths**, **submodules**, and a **trigger
type** of `push` or `tag`. The repository and branch lists are fetched live from
GitHub through the App. See [Application sources](/applications/sources/) for the
full per-service flow.

## Automatic deploys

GitHub auto-deploy is the one fully turnkey path in Docklands. The App carries a
**single webhook** (registered at App creation) pointing at `/api/deploy/github`,
and GitHub signs every delivery. Docklands looks up the connection by the
delivery's installation ID, verifies the signature against the stored webhook
secret, and only then acts. You do not add a webhook per repository.

On a verified event, Docklands:

- **push** to a branch — deploys every GitHub-sourced service with **Autobuild**
  on whose owner, repository, and branch match (and whose trigger type is
  `push`), subject to [watch paths](/git/overview/#watch-paths).
- **push** of a tag (`refs/tags/...`) — deploys matching services whose trigger
  type is `tag`.
- **pull_request** opened/synchronized/reopened — creates or updates a
  [preview deployment](/applications/preview-deployments/) for apps that have
  previews enabled; closing the PR tears the preview down.

Commit messages containing a skip keyword (`[skip ci]`, `[ci skip]`, `[no ci]`,
`[skip actions]`, `[actions skip]`) are ignored.

## Pull-request preview deployments

Previews are a GitHub-only feature. When enabled on an application, an opened PR
spins up an isolated deployment of that branch and Docklands posts a status
comment on the PR with the preview URL.

By default, previews only run for PRs whose author has **write**, **maintain**,
or **admin** access to the repository — Docklands checks the author's
collaborator permission via the App before deploying, and posts a "blocked"
comment otherwise. You can configure the limit, optional triggering labels, and
this collaborator check per application.

:::danger
You can disable the collaborator-permission check per application
(`previewRequireCollaboratorPermissions`). **Do not** disable it for public
repositories: it is the control that stops an untrusted fork PR from running
arbitrary code — and reading your environment variables and secrets — on your
runtime worker. With it off, *any* PR author can trigger a build.
:::

## Editing and removing

From the provider row you can **Edit** (rename the connection, or use **Test
Connection** to confirm the App can list repositories) and **Delete**. Test
Connection reports how many repositories the installation can see; a count of
zero usually means the App is created but not installed on any repository.

Deleting the Docklands connection removes the stored credentials but does **not**
delete the App on GitHub — remove that separately from your GitHub App settings
if you no longer want it.
