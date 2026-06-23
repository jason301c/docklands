---
title: Gitea
description: Connect a Gitea instance to Docklands with an OAuth2 application, authorize access, and deploy repositories with refresh-token webhooks.
---

Gitea connects through an **OAuth2 application** you register in your Gitea
instance. You give Docklands the client ID and secret, authorize once, and
Docklands stores the access and refresh tokens to browse repositories, read
branches, and clone code. Works with `gitea.com` and self-hosted Gitea.

Connect Gitea under **Settings → Git Providers** (`/dashboard/settings/git-providers`).

## Register the OAuth2 application in Gitea

1. In Gitea, go to **Settings → Applications**
   (`<your-gitea>/user/settings/applications`).
2. Under **Manage OAuth2 Applications**, create a new application named
   **Docklands**.
3. Set the **Redirect URI** to the value Docklands shows in the Add dialog:

   ```text
   https://<your-docklands-host>/api/providers/gitea/callback
   ```

4. Create it, and copy the generated **Client ID** and **Client Secret**.

## Add the connection in Docklands

On the Git Providers page, click **Gitea** and fill in:

- **Name** — a label for this connection.
- **Gitea URL** — defaults to `https://gitea.com`; set your instance URL for
  self-hosted Gitea.
- **Internal URL** (optional) — an internal address such as `http://gitea:3000`,
  used for the OAuth token exchange and API calls when Gitea runs on the same
  host as Docklands (for example a Docker service name).
- **Redirect URI** — shown read-only; this is what you pasted into Gitea.
- **Client ID** and **Client Secret** — from the step above.

When you save, Docklands creates the connection and immediately opens Gitea's
authorization page in a new window for the `read:repository read:user
read:organization` scopes. Approve it; Gitea redirects back to
`/api/providers/gitea/callback`, Docklands stores the tokens, and you return to
the Git Providers page with a "connected" confirmation. Docklands refreshes the
access token automatically when it nears expiry.

If the authorization window does not open or you dismissed it, open the
connection's **Edit** dialog and use **Connect to Gitea** (or **Test Connection**,
which offers an **Authorize Now** action when the token is missing).

:::note
The Redirect URI is built from the host in your browser's address bar when you
open the dialog. Register the Gitea application using the real public hostname and
paste exactly that Redirect URI into Gitea, or the authorization will be rejected.
:::

## Use it on a service

On a service's **General → Provider** tab, choose **Gitea**, then select the
repository and branch. See [Application sources](/applications/sources/) for the
full per-service flow.

## Automatic deploys

Docklands does **not** register a webhook in Gitea for you. To deploy on push,
add a webhook in your Gitea repository pointing at the per-service refresh-token
URL from the service's **Deployments** tab:

```text
https://<your-docklands-host>/api/deploy/<refreshToken>
https://<your-docklands-host>/api/deploy/compose/<refreshToken>
```

Send **Push events**. A push then deploys the service if **Autobuild** is on and
the pushed branch matches the configured branch, subject to
[watch paths](/git/overview/#watch-paths).

Gitea connections do **not** support pull-request preview deployments — that
feature is GitHub-only.

## Editing and removing

From the provider row you can **Edit** (rename, change the URL/internal URL, or
re-enter the client credentials), **Test Connection**, re-**Connect to Gitea**,
or **Delete** the connection. Deleting removes the stored tokens from Docklands;
remove the OAuth2 application separately in Gitea if you no longer want it.
