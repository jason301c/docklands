---
title: Domains
description: Attach a domain to a service, route by host and path, and serve it over HTTPS with Let's Encrypt or a custom certificate.
---

A domain is how outside traffic reaches one of your services. You attach domains
per-service from the workspace canvas: open an application or a Compose service,
go to its **Domains** section, and add a host. Docklands turns each domain into a
[Traefik](/networking/ingress/) router that forwards matching requests to the
running container.

Domains live on the service, not on the project. Deleting the service removes its
domains; the database row cascades and the generated Traefik config file is
cleaned up.

## Ingress modes: tunnel or public

Every domain has an **ingress mode** that decides how outside traffic gets in:

- **Cloudflare Tunnel** (recommended, the default once you connect Cloudflare):
  no open ports, public IP, manual DNS, or certificate setup — Cloudflare
  terminates HTTPS at the edge and forwards to Traefik. See
  [Cloudflare Tunnels](/networking/cloudflare-tunnels/).
- **Public IP:** the classic path — your server's published ports `80`/`443`,
  a DNS A record pointing at the server, and TLS via
  [Let's Encrypt or a custom certificate](/networking/tls-certificates/).

Either way, Traefik does the host-based routing described below — the mode only
changes how requests reach Traefik. Pick the default during **Setup** (top of the
sidebar); the **Add domain** dialog lets you override it per domain, and a single
server can mix both.

## How a domain routes traffic

Every domain you add produces a Traefik HTTP router whose rule combines the host
and (optionally) a path prefix:

- **Host** — the public hostname, e.g. `api.docklands.example`. Required.
  Internationalized domain names are converted to ASCII punycode automatically,
  so `тест.рф` works.
- **Path** — defaults to `/`. If you set a more specific path such as `/api`,
  the router only matches requests under that prefix (`PathPrefix`), which lets
  several services share one host.
- **Container Port** — the port your app listens on *inside* the container
  (e.g. `3000` for Node, `80` for Nginx). This is not a host port; Traefik
  reaches the container over the internal `docklands-network`. Defaults to
  `3000`.

For a plain application, adding a domain applies immediately. For a **Compose**
service you must also pick the **Service Name** (the service inside your
`docker-compose.yml`) and then **redeploy** the stack for the change to take
effect — the dialog reminds you of this.

:::note
The dialog can generate a free throwaway hostname for you (the dice button). It
returns an `sslip.io`-style wildcard domain that resolves to your ingress IP, so
you can test without owning a domain. For remote runtime workers it uses the
worker's IP; for the local runtime it uses the **Public IP** from
[ingress settings](/networking/ingress/#ingress-settings). `sslip.io` is plain
HTTP only — HTTPS and certificate options have no effect on it.
:::

## Point DNS at your server

Docklands does not manage DNS for you — it runs on your own VM. Before a real
domain works you must create a DNS record at your registrar that points the host
at your server's public IP:

1. Add an **A record** for the host (`@`, or a subdomain like `api`) whose value
   is your ingress server's public IP.
2. Wait for propagation (usually 15–30 minutes).
3. Visit the domain to confirm it reaches your service.

The Domains list includes a **DNS Configuration Guide** helper (the question-mark
icon) that shows the exact A record to create and the ingress address to use.

:::tip
There is an optional **domain validation** check that resolves the host over DNS
and compares it to your expected IP. If the host sits behind a CDN such as
Cloudflare, validation still passes but warns you, because the resolved IP is the
CDN's edge rather than your server.
:::

:::note[A "valid" result behind a CDN is not a guarantee]
When the host resolves to a known CDN IP (for example Cloudflare), domain
validation reports **success** even though it cannot confirm that the CDN's origin
actually points back at this server. Treat a CDN-fronted pass as "DNS is plausibly
wired," not as proof the origin is correct — verify the CDN's origin
configuration separately if traffic does not reach your service.
:::

## Serve over HTTPS

Turn on the **HTTPS** switch to provision TLS. You then choose a **Certificate
Provider**:

- **Let's Encrypt** — Traefik requests and renews a certificate automatically
  using the ACME HTTP-01 challenge. This requires the domain's DNS to already
  point at your server and ports `80`/`443` to be reachable from the internet, so
  the challenge can complete. See [TLS certificates](/networking/tls-certificates/)
  for the resolver setup and rate-limit warnings.
- **Custom** — use a named certificate *resolver* you have defined yourself in
  the Traefik static config. You type the resolver name into **Custom Certificate
  Resolver**.
- **None** — terminate TLS without a managed certificate (for example when a
  custom certificate file is matched by SNI, or TLS is handled upstream).

When HTTPS is on, Docklands creates **two** routers for the domain:

- an HTTP (`web`) router that does nothing but redirect to HTTPS, via the
  built-in `redirect-to-https` middleware;
- an HTTPS (`websecure`) router that carries the real routing, middlewares, and
  TLS settings.

:::caution[Let's Encrypt has limits — get DNS right first]
Automatic HTTPS uses the Let's Encrypt **HTTP-01 challenge only**, so it cannot
issue wildcard certificates, and it is wired up only when Docklands runs in
production. Each toggle of HTTPS against a host whose DNS does not yet point at
your server is a failed issuance attempt, and enough failures hit Let's Encrypt's
weekly per-domain rate limit and lock you out of new certificates for that domain
for up to a week. Confirm the domain's DNS resolves to your server before turning
HTTPS on.
:::

:::caution
**Custom certificate files and "Custom" certificate resolvers are different
things.** Uploading a certificate under
[Settings → Certificates](/networking/tls-certificates/#upload-a-custom-certificate)
writes cert files that Traefik serves by SNI — for that case, set the provider to
**None**. The **Custom** provider instead points at an ACME-style *resolver*
name, and Docklands ships only one resolver (`letsencrypt`) out of the box. If
you select **Custom** and name a resolver that does not exist in
[`traefik.yml`](/networking/ingress/#editing-traefik-config), Traefik will fail
to serve that route.
:::

## www and other redirects

The HTTP→HTTPS redirect is automatic whenever HTTPS is enabled. For other
rewrites — forcing `www`, forcing non-`www`, or arbitrary URL rewrites — add a
[redirect](/networking/redirects/) to the application. Redirects are matched
before the request reaches your container and apply to every domain on that
application.

## Path rewriting

When several services share a host under different path prefixes, the public path
rarely matches the path your app expects internally. Two switches handle this:

- **Strip Path** — removes the public prefix before forwarding. With a domain
  path of `/api` and strip enabled, a request to `/api/users` reaches your
  container as `/users`. Strip Path is only valid when the path is something
  other than `/`.
- **Internal Path** — prepends a fixed prefix on the way in. If your app is
  mounted at `/app` internally, set Internal Path to `/app` and requests are
  rewritten accordingly. Defaults to `/`.

These are implemented as Traefik `stripPrefix` / `addPrefix` middlewares. Strip
runs before add, so you can strip the public prefix and then prepend a different
internal one.

## Custom entrypoints and extra middlewares

Two advanced fields cover unusual setups:

- **Custom Entrypoint** — by default routers attach to the `web` and `websecure`
  entrypoints (ports 80/443). If you exposed an extra entrypoint on the ingress
  runtime, you can bind the domain to it by name. With a custom entrypoint
  Docklands does not auto-create the HTTP→HTTPS redirect router.
- **Middlewares** — a free-form list of Traefik middleware references (e.g.
  `rate-limit@file`, `auth@file`). These must already be defined in your Traefik
  configuration; Docklands only references them by name, it does not create them.
  Edit them under [proxy files](/networking/ingress/#editing-traefik-config).
