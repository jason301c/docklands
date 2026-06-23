---
title: GitLab
description: Connect GitLab to Docklands with an OAuth application, authorize access, and deploy repositories with refresh-token webhooks.
---

GitLab connects through an **OAuth application** you create in GitLab. You give
Docklands the application's ID and secret, then authorize it once; Docklands
stores the resulting access and refresh tokens and uses them to browse
repositories, read branches, and clone code. Works with both `gitlab.com` and
self-hosted GitLab instances.

Connect GitLab under **Settings → Git Providers** (`/dashboard/settings/git-providers`).

## Create the OAuth application in GitLab

1. In GitLab, go to your profile **Settings → Applications**
   (`<your-gitlab>/-/profile/applications`).
2. Create a new application named **Docklands**.
3. Set the **Redirect URI** to the value Docklands shows you in the Add dialog:

   ```text
   https://<your-docklands-host>/api/providers/gitlab/callback
   ```

4. Grant these **scopes**: `api`, `read_user`, `read_repository`.
5. Save, and copy the generated **Application ID** and **Secret**.

## Add the connection in Docklands

Back on the Git Providers page, click **GitLab** and fill in:

- **Name** — a label for this connection.
- **GitLab URL** — defaults to `https://gitlab.com`; set your instance URL for
  self-hosted GitLab.
- **Internal URL** (optional) — an internal address such as `http://gitlab:80`,
  used for the OAuth token exchange when GitLab runs on the same host as
  Docklands (for example a Docker service name). Token exchange and API calls
  prefer this URL when set.
- **Redirect URI** — shown read-only; this is the value you pasted into GitLab.
- **Application ID** and **Application Secret** — from the step above.
- **Group Name** (optional) — a comma-separated list of group slugs to scope
  repository listing to. Leave empty to list your user-namespace repositories.

Save the connection. It is created but **not yet authorized** — the row shows an
**Action Required** badge.

## Authorize the connection

Click the **Action Required** badge (or the authorize link). Docklands sends you
to GitLab's `/oauth/authorize` for the `api read_user read_repository` scopes.
Approve, and GitLab redirects back to `/api/providers/gitlab/callback`, where
Docklands stores the access and refresh tokens. The connection is now usable.
Docklands refreshes the access token automatically when it nears expiry.

:::note
The Redirect URI is built from the host in your browser's address bar when you
open the dialog. Set up GitLab while visiting Docklands on the real public
hostname, and paste exactly that Redirect URI into GitLab — GitLab rejects the
authorization if the URI does not match what the application was registered with.
:::

## Use it on a service

On a service's **General → Provider** tab, choose **Gitlab**, then select the
repository and branch. See [Application sources](/applications/sources/) for the
full per-service flow.

## Automatic deploys

Docklands does **not** register a webhook in GitLab for you. To deploy on push,
add a webhook in your GitLab project pointing at the per-service refresh-token
URL from the service's **Deployments** tab:

```text
https://<your-docklands-host>/api/deploy/<refreshToken>
https://<your-docklands-host>/api/deploy/compose/<refreshToken>
```

Send **Push events**. A push then deploys the service if **Autobuild** is on and
the pushed branch matches the configured branch, subject to
[watch paths](/git/overview/#watch-paths). See
[the overview](/git/overview/#per-service-refresh-token-webhook-all-sources) for
how this endpoint is authenticated.

GitLab connections do **not** support pull-request (merge-request) preview
deployments — that feature is GitHub-only.

## Editing and removing

From the provider row you can **Edit** (rename, change the URL/internal URL or
group name) and run **Test Connection**, or **Delete** the connection. Deleting
removes the stored tokens from Docklands; remove the OAuth application separately
in GitLab if you no longer want it.

:::caution
Repository and branch browsing and **Test Connection** currently call a
`/api/v4/workspaces` path on the GitLab API. GitLab's REST API exposes these
resources under `/api/v4/projects`, not `workspaces`, so against a standard
GitLab instance these calls return no results (or an error) and the repository
and branch dropdowns can come up empty even when the OAuth connection itself
authorized successfully. If you hit this, deploy via the **Git** source type with
the repository's clone URL (and an [SSH key](/git/ssh-keys/) for private repos)
until it is fixed.
:::
