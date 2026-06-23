---
title: Redirects
description: Add HTTP redirects to an application — force www, force non-www, or rewrite URLs with a regex.
---

A redirect rewrites the request URL before it reaches your container. Use one to
force `www` (or non-`www`), move traffic from an old path to a new one, or
normalize URLs. Redirects are configured **per application** under its advanced
settings, and apply to every domain on that application.

Redirects are implemented as Traefik `redirectRegex` middlewares: Docklands adds
the middleware to the application's dynamic config and attaches it to the
application's routers, so it runs at the edge before any request hits your
service.

:::note
Redirects are configured on **applications only** — Compose services and
preview deployments do not have them. The HTTP→HTTPS redirect is separate and
automatic — it is created for you whenever you enable
[HTTPS on a domain](/networking/domains/#serve-over-https), so you do not add a
redirect for that.
:::

## Add a redirect

In the application's advanced settings, open **Redirects** and add one. A
redirect has three fields:

- **Regex** — a pattern matched against the incoming URL, e.g.
  `^https?://www\.(.+)`.
- **Replacement** — the target URL, which can reference capture groups from the
  regex with `${1}`, `${2}`, … e.g. `https://${1}`.
- **Permanent** — when on, Traefik returns a permanent (301) redirect; when off,
  a temporary (302) one. Use permanent only once you are sure of the target,
  because browsers and search engines cache it aggressively.

### Presets

Two presets fill the fields for the common cases:

- **Redirect to www** — `^https?://(?:www\.)?(.+)` → `https://www.${1}`
- **Redirect to non-www** — `^https?://www\.(.+)` → `https://${1}`

Pick a preset, adjust if needed, and save.

## How it applies

Saving a redirect writes the middleware into the application's Traefik dynamic
config and attaches it to the application's routers immediately — no redeploy is
needed for a plain application. Editing or deleting a redirect updates or removes
that middleware the same way.

Because the redirect lives on the application's routers, it affects **all** of
that application's domains. If you need a redirect to apply to only one host,
encode the host in the regex so it only matches that host.

:::note
Redirects are skipped for **preview-deployment** wildcard subdomains. A
per-branch preview environment does not inherit the parent application's
redirects (so, for example, a `www` redirect does not break preview URLs).
:::

:::tip
For one-off or advanced rewrites that the regex redirect cannot express, you can
define your own Traefik middleware in the
[proxy files](/networking/ingress/#editing-traefik-config) and reference it by
name in the domain's **Middlewares** field.
:::
