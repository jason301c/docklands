---
title: Template catalog
description: Browse and deploy pre-built Docker Compose stacks from the Docklands template catalog, and understand how single-database templates are routed to the managed-database picker.
---

The **template catalog** is a library of ready-to-run Docker Compose stacks for
popular open-source applications. Deploying a template creates a
[Compose service](/compose/overview/) in your workspace, pre-configured with
generated secrets, domains, and connection variables, so you can stand up an app
without writing a Compose file yourself.

Templates ship with Docklands as plain Compose YAML files with a small metadata
header, so the catalog works fully offline against the copy on your VM.

## Browsing the catalog

Open the **Create from Template** dialog from the **Add** menu on the workspace
canvas. The catalog shows one card per template, each with a logo, name,
description, version badge, and tags.

You can narrow the list with:

- **Search** — matches the template name and description.
- **Tag filter** — select one or more tags; a template matches if it has any of
  the selected tags.
- **Bookmarks** — bookmark templates with the bookmark icon on each card, then
  toggle the bookmark filter to show only your bookmarked templates.
- **Layout toggle** — switch between a detailed card view and a compact icon
  grid.

In the detailed view, each card also links to the template's GitHub, website, and
documentation when those are set in the template metadata.

## How the catalog is built

Each template is a Compose file under the app's `templates/compose/` directory.
Docklands derives the catalog entirely from those files:

- The **id** is the file name (e.g. `pocketbase.yaml` → `pocketbase`); the
  **name** is a title-cased version of the id.
- A **header comment block** at the top of the file supplies metadata. Header
  lines look like `# key: value` and are read until the first non-comment line.
  Recognized keys include `slogan` (used as the description), `category`, `tags`
  (comma-separated), `logo`, `port`, `documentation`, `website`, `github`,
  `minversion` (shown as the version), and `ignore`.
- A template with `# ignore: true` is hidden from the catalog.

```yaml
# documentation: https://pocketbase.io/docs/
# slogan: Open Source backend for your next SaaS and Mobile app in 1 file
# category: backend
# tags: pocketbase,backend,saas,mobile,api
# logo: svgs/pocketbase.svg
# port: 8080

services:
  pocketbase:
    image: ghcr.io/coollabsio/pocketbase:latest
    environment:
      - SERVICE_URL_POCKETBASE_8080
    volumes:
      - pocketbase-data:/app/pb_data
```

:::note
Templates are read from `templates/compose/` relative to the app's working
directory by default. An operator can point Docklands at a different directory
with the `DOCKLANDS_TEMPLATES_DIR` environment variable to ship a custom catalog.
:::

## Deploying a template

On a template card, choose **Create**. For a normal (multi-service or
non-database) template, you confirm in a dialog, optionally choose a runtime
worker for **placement**, and Docklands does the rest:

1. It reads the template's Compose file and **processes** it. Processing expands
   Docklands' magic variables — generating passwords, base64/hex secrets, JWTs,
   and random domains — and rewrites the Compose file with the resolved values.
2. It creates a Compose service with a unique app name, the processed Compose
   file as its **raw** source, the generated environment, and isolated deployment
   enabled.
3. It persists the side records the template produced: file **mounts**, generated
   **domains**, and any **databases detected inside the stack** (see
   [Databases embedded in a stack](/compose/embedded-databases/)).

The new service appears on your canvas; deploy it like any other Compose service.

### Magic variables

Templates use Coolify-style `SERVICE_*` placeholders that Docklands resolves at
create time. For example `SERVICE_PASSWORD_DB` generates a password,
`SERVICE_BASE64_64_KEY` generates a 64-character base64 secret, and
`SERVICE_URL_APP_8080` / `SERVICE_FQDN_APP_8080` generate a random
`*.sslip.io` domain pointed at the service on the given port and register that
domain for ingress. The resolved values are written into the service's
environment, so the same secret is reused everywhere it is referenced.

:::note
Generated domains use the `sslip.io` wildcard-DNS service to give each app an
immediately resolvable hostname derived from your server IP, with no DNS setup.
Point a real domain at the service later from its **Domains** tab.
:::

## The managed-database boundary

Most templates are applications (with or without a bundled database) and deploy
as Compose services. There is one deliberate exception.

When a template is **just a single database** — a Compose file with exactly one
service, and that service is one of Docklands' six managed engines — it is a poor
fit for an opaque Compose deploy. Running it as Compose would give you a database
that Docklands cannot fully manage the way a first-class
[managed database](/databases/overview/) is managed.

So the catalog **routes bare single-database templates to the managed-database
picker** instead. Such a template's card shows a **Database** badge and a *Create
as a managed database* label. Choosing **Create** opens the **Add Database**
dialog preset to the detected engine, and you create a proper managed database —
not a Compose service.

Templates that merely *include* a database alongside other services (the common
case) are not routed this way. They show an **Includes database** badge and
deploy normally as a Compose service; the bundled database is then surfaced as an
[embedded database](/compose/embedded-databases/).

:::caution
The bare-database routing is a real product boundary, but it is currently
**dormant in the shipped catalog**: none of the bundled templates is a
single-service database, so in practice every template you see deploys as a
Compose service. The routing only activates if a single-service database template
is added (for example through a custom `DOCKLANDS_TEMPLATES_DIR`). To create a
standalone managed database today, use **Add Database** directly rather than the
template catalog. See [Databases](/databases/overview/).
:::
