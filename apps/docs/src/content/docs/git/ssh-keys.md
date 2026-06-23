---
title: SSH Keys
description: Manage SSH key pairs in Docklands — generate or import keys, use them as deploy keys for private Git repos, and connect remote runtime workers.
---

SSH keys in Docklands are reusable key pairs your organization manages in one
place under `/dashboard/settings/ssh-keys`. They serve two distinct jobs:

1. **Deploy keys for private Git repos** — clone a repository over an SSH URL
   when you deploy from the [**Git** source type](/applications/sources/) (the
   public-URL source) instead of a connected provider.
2. **Access to remote runtime workers** — authenticate the SSH connection
   Docklands uses to drive Docker on a remote build/runtime machine.

The same key can be used for both. Keys are scoped to the active organization, so
any member with the right permission can select an existing key without seeing
the others' private material in the UI list.

## Create a key

Click **Add SSH Key** and provide:

- **Name** — a label (used to identify the key in dropdowns and downloads).
- **Description** — optional.
- **Private Key** and **Public Key** — the key pair.

You can either **import** an existing pair by pasting both fields, or
**generate** one in place with **Generate RSA SSH Key** (4096-bit RSA) or
**Generate ED25519 SSH Key**. Generating fills both fields for you, and you can
**Download Public Key** / **Download Private Key** to save them locally. Save to
store the key.

:::caution
Both halves of the key are stored in the Docklands PostgreSQL database, including
the **private key**, and they are not encrypted at rest by the application.
Anyone with database or backup access can read every private key. Use keys
dedicated to Docklands (not your personal SSH identity), prefer per-repo deploy
keys with read-only access, and protect the database and its backups like the
secret store they are.
:::

## Use a key as a Git deploy key

To clone a private repository without connecting a provider:

1. Add the **public** half of one of these keys as a **deploy key** on the
   repository (in GitHub/GitLab/Gitea/Bitbucket, or any Git host). Read access is
   enough to deploy.
2. On the service's **General → Provider** tab, choose the **Git** source type.
3. Enter the repository's **SSH clone URL** (for example
   `git@github.com:you/repo.git`), the **branch**, and select your **SSH Key**
   from the dropdown.

At deploy time Docklands writes the private key to a temporary file on the
runtime worker, adds the host to `known_hosts` on first contact
(`StrictHostKeyChecking=accept-new`), clones over SSH, and records the key's
**Last Used** time. If the clone URL is an SSH URL and no key is selected, the
deploy fails with a message telling you to set one.

:::note
This SSH-key path is only available for the **Git** source type. The connected
GitHub, GitLab, Bitbucket, and Gitea providers authenticate with their own
tokens/Apps and ignore SSH keys entirely — you do not need a key for those.
:::

:::caution
First-contact host keys are accepted automatically
(`StrictHostKeyChecking=accept-new`) rather than pinned ahead of time. This keeps
clones working against hosts that do not answer `ssh-keyscan`, but it means the
host key is trusted on first use rather than verified against a known value.
Clone from networks and hosts you trust.
:::

## Use a key for a remote runtime worker

When you register a **remote** [runtime worker](/git/overview/), Docklands
connects to it over SSH to run Docker commands, set it up, and stream logs. You
select one of these SSH keys for that connection; Docklands authenticates as the
configured user with the key's private half. The key's public half must be in the
remote machine's `authorized_keys`.

This is the same key store as deploy keys, but a worker key generally needs an
account that can run Docker on the remote host, so keep worker keys separate from
read-only repo deploy keys where you can.

## Edit, rotate, and remove

From the key list you can **Edit** a key's **name** and **description** — the key
material itself is not editable after creation. To rotate a key, create a new one
(update the repo deploy key or the worker's `authorized_keys` accordingly,
re-select it on the affected services/workers), then **Delete** the old one.

Deleting a key is permission-gated and org-scoped. Be careful: services or
runtime workers still pointing at a deleted key will fail their next SSH clone or
connection, since the key they reference no longer exists.
