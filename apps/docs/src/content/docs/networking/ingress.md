---
title: Ingress (Traefik)
description: How Docklands runs Traefik as the edge proxy, what the ingress settings control, and how to edit the generated proxy files.
---

Docklands routes all inbound web traffic through **Traefik**, which it runs as a
container called `docklands-traefik`. Traefik is the edge proxy (the "ingress
runtime"): it listens on the public ports, terminates TLS, applies redirects and
middlewares, and forwards each request to the right container based on the
[domains](/networking/domains/) you configure.

You generally do not talk to Traefik directly. Docklands generates Traefik's
configuration as YAML files on disk and Traefik watches those files. This page
explains that model and the surfaces that control it.

## How Docklands runs Traefik

On startup (in server mode) Docklands bootstraps Traefik for you:

- It pulls and starts the `docklands-traefik` container (a Swarm service in
  production, a standalone container in local development) on the
  `docklands-network` overlay.
- It publishes the public entrypoints to the host: **`web`** on port `80` and
  **`websecure`** on port `443` (TCP and UDP/HTTP3). These bind directly to the
  host machine.
- It mounts two things into the container: the **static config**
  (`traefik.yml`), and the **dynamic config directory** that Docklands writes
  per-service files into. It also mounts the Docker socket so Traefik can
  discover Swarm/Docker services.

Traefik configuration comes in two layers:

- **Static config** (`traefik.yml`) — entrypoints, providers, the API, and
  certificate resolvers (including the `letsencrypt` ACME resolver). Changing it
  requires recreating/reloading Traefik.
- **Dynamic config** (the `dynamic/` directory) — routers, services, and
  middlewares. Docklands writes one file per application/Compose service, plus
  shared files like `middlewares.yml`. Traefik hot-reloads these without a
  restart.

:::note
Docklands writes Traefik config files; it does **not** call a Traefik API to
configure routes. Editing a generated file changes live routing as soon as
Traefik picks it up.
:::

## What gets generated

When you add a domain or redirect, Docklands writes (or updates) the dynamic
config file named after the service's internal app name, e.g.
`my-app.yml`. Inside it:

- an HTTP **router** per domain (and a second `websecure` router when HTTPS is
  on);
- a load-balancer **service** pointing at `http://<app>:<port>` over the internal
  network;
- references to any **middlewares** (HTTPS redirect, path strip/add, redirects,
  custom middlewares).

Removing the last domain on a service deletes its file entirely. The Docklands
control plane itself is routed the same way through a `docklands.yml` file.

## Ingress settings

The **Settings → Ingress** page (`/dashboard/settings/ingress`) controls the
edge proxy as a whole. It has two cards:

### Ingress Domain

Assign a domain to the Docklands control plane itself and, optionally, secure it:

- **Domain** — the hostname you use to reach the Docklands dashboard.
- **Let's Encrypt Email** — the real ACME contact address. Setting this patches
  the email in `traefik.yml`, replacing the placeholder default. Set it before
  relying on Let's Encrypt (see [TLS certificates](/networking/tls-certificates/#lets-encrypt-automatic)).
- **HTTPS** + **Certificate Provider** — enable TLS for the dashboard, with
  **None** or **Let's Encrypt**.

:::caution
Changing the control-plane domain changes the URL that GitHub Apps, webhooks, and
preview environments call back to. If you move the dashboard to a new host,
update your Git provider apps so autobuilds and previews keep working — the form
warns you when the host changes.
:::

### Ingress Runtime

Operational controls for the proxy and runtime state. From here you can:

- **Reload** the ingress runtime (recreate the `docklands-traefik` container) and
  reload the Docklands control plane.
- See and copy the runtime's **Public IP** — the value used when generating
  test domains and shown in the DNS helper.
- View the running Docklands **version** and toggle Docker cleanup.

### Additional port mappings

Traefik only exposes `80` and `443` by default. To expose extra TCP/UDP/SCTP
ports through the ingress runtime — for example a database port or a custom
entrypoint — use **Additional Port Mappings**. Each mapping is a **Target Port**
(inside the container) to **Published Port** (on the host) with a protocol.

:::caution
Saving additional port mappings **recreates the ingress runtime container from
scratch** — it is deleted and re-created, which can briefly interrupt every
application served through ingress. Apply these during a maintenance window.
:::

For exposing a *single application's* port directly on the host (bypassing
HTTP routing), use the application's own port mappings rather than the global
ingress ports.

## Editing Traefik config

The **Proxy Files** page (`/dashboard/proxy-files`) is a file browser and editor
over the Traefik configuration directory (`/etc/docklands/traefik`). It lists the
static `traefik.yml`, the generated per-service dynamic files, `middlewares.yml`,
and the certificate files, and lets you edit them inline. Use the runtime-worker
filter at the top to view files on a specific worker.

This is the place to:

- add a **custom certificate resolver** (e.g. a DNS-01 resolver for wildcards) to
  `traefik.yml`;
- define **custom middlewares** that you then reference by name on a domain;
- inspect exactly what Docklands generated for a service.

The editor validates YAML before saving. Traefik supports Go templating in
dynamic configs (e.g. `{{range}}`), which is not valid YAML — for those files
check **Skip YAML validation** before saving. Each file has a **Lock/Unlock**
toggle to guard against accidental edits.

:::caution
**Hand-editing proxy files is powerful and unguarded.** A broken router, a typo
in `traefik.yml`, or invalid YAML can take every application offline, because
Traefik may reject the whole config or stop routing. Edits apply as soon as
Traefik reloads. Changes to files Docklands generates (per-service dynamic
configs) can also be overwritten the next time you change that service's domains
or redeploy. Prefer the workspace UI for routine routing, and keep raw edits for
genuinely custom needs. Read access requires the `traefikFiles` read permission;
writing requires `traefikFiles` write.
:::

## Inspecting a service's config

Each application also has a read-focused **Ingress Config** view in its advanced
settings, showing the generated Traefik config for just that service. It is the
quickest way to confirm what routing Docklands produced from your domain and
redirect settings, and it offers a guarded inline edit for service-specific
overrides.
