---
title: Bitbucket
description: Connect Bitbucket Cloud to Docklands with an Atlassian API token and deploy repositories with refresh-token webhooks.
---

Bitbucket connects with an **Atlassian API token** rather than an OAuth app or an
installed application. You create a scoped API token, give Docklands your
Atlassian email plus the token, and Docklands uses HTTP Basic auth against the
Bitbucket Cloud API to browse repositories, read branches, and clone code. This
targets **Bitbucket Cloud** (`bitbucket.org`).

Connect Bitbucket under **Settings → Git Providers** (`/dashboard/settings/git-providers`).

## Create an Atlassian API token

1. Open Atlassian's API token page
   (`https://id.atlassian.com/manage-profile/security/api-tokens`).
2. Choose **Create API token with scopes**.
3. Set an expiration date (maximum one year — you will need to rotate before it
   expires).
4. Select the **Bitbucket** product, and grant these scopes:
   - `read:repository:bitbucket`
   - `read:pullrequest:bitbucket`
   - `read:webhook:bitbucket`
   - `read:workspace:bitbucket`
   - `write:webhook:bitbucket`
5. Create the token and copy it — Atlassian shows it only once.

## Add the connection in Docklands

On the Git Providers page, click **Bitbucket** and fill in:

- **Name** — a label for this connection.
- **Bitbucket Username** — your Bitbucket username.
- **Bitbucket Email** — your **Atlassian account email**. This is required:
  Bitbucket API-token authentication uses `email:token` as the Basic-auth
  credential, so calls fail without it.
- **API Token** — the token you just created.
- **Workspace Name** (optional) — set this for organization/team accounts;
  repository listing is scoped to this workspace when provided, otherwise to your
  username.

Save. There is no separate authorization step — the token *is* the credential,
so the connection is usable immediately.

## Use it on a service

On a service's **General → Provider** tab, choose **Bitbucket**, then select the
repository and branch. See [Application sources](/applications/sources/) for the
full per-service flow.

## Automatic deploys

Docklands does **not** create a webhook in Bitbucket for you. To deploy on push,
add a repository webhook in Bitbucket pointing at the per-service refresh-token
URL from the service's **Deployments** tab:

```text
https://<your-docklands-host>/api/deploy/<refreshToken>
https://<your-docklands-host>/api/deploy/compose/<refreshToken>
```

Trigger it on **Repository push**. A push then deploys the service if
**Autobuild** is on and the pushed branch matches the configured branch.

Bitbucket [watch paths](/git/overview/#watch-paths) work a little differently
from the other providers: the push payload does not list changed files, so
Docklands calls the Bitbucket `diffstat` API for each pushed commit to find the
changed paths. That extra call uses the same API token, which is why the token's
repository scope matters even for path filtering.

Bitbucket connections do **not** support pull-request preview deployments — that
feature is GitHub-only.

## Editing and removing

From the provider row you can **Edit** (update the username, email, workspace, or
token) and run **Test Connection**, or **Delete** the connection. Test Connection
reports how many repositories the token can list. Deleting removes the stored
token from Docklands; revoke the token in Atlassian separately.

:::caution
The API token is stored in the Docklands database and is a long-lived Bitbucket
credential with the scopes you granted. Rotate it before its expiry, scope it to
the workspace you actually deploy from, and revoke it in Atlassian if it leaks.
:::
