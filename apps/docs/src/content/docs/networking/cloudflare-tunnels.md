---
title: Cloudflare Tunnels
description: Put your apps online through a Cloudflare Tunnel — no open ports, no public IP, no manual DNS, and free HTTPS. The recommended, beginner-first ingress mode.
---

A **Cloudflare Tunnel** is the easiest way to get your apps online, and the
recommended default in Docklands. Instead of opening ports and pointing DNS at
your server, Docklands runs an outbound-only connection from your machine to
Cloudflare's edge. Cloudflare routes your domain to that tunnel, and the tunnel
forwards traffic to your services.

Compared with the classic [public-IP path](/networking/ingress/), a tunnel
removes every step a beginner usually gets stuck on:

- **No open ports.** The connection is outbound, so your firewall stays closed.
- **No public IP.** It works on a home server behind NAT/CGNAT, not just a VPS.
- **No manual DNS.** Docklands creates the DNS record for each domain via the
  Cloudflare API.
- **No certificate setup.** Cloudflare terminates TLS at the edge — free and
  auto-renewed. There is no Let's Encrypt step on your server.

You also get Cloudflare's CDN and DDoS protection for free.

## How it works

```
Internet ─▶ Cloudflare edge (TLS) ─▶ cloudflared ─▶ Traefik ─▶ your container
                                       (outbound)    (routes by host)
```

Docklands runs one managed `cloudflared` container per server with a single
catch-all rule that forwards everything to its [Traefik](/networking/ingress/)
ingress. Traefik then routes each request to the right container by hostname —
exactly as it does for the public path. A tunnel only changes **how traffic
enters**; your per-service [domains](/networking/domains/) work the same way.

Because TLS terminates at Cloudflare, tunnel domains serve plain HTTP internally,
so their certificate type is forced to **None** — there is nothing to configure.

## Connect Cloudflare

You connect Cloudflare once, from **Setup** (top of the sidebar) or **Domains →
Cloudflare Tunnels** (`/dashboard/settings/cloudflare`).

1. In the Cloudflare dashboard, create an **API token**
   (<https://dash.cloudflare.com/profile/api-tokens>) with two permissions:
   - **Account · Cloudflare Tunnel · Edit**
   - **Zone · DNS · Edit** — scoped to the domains you want to use.
2. Paste the token into Docklands and choose **Connect**. Docklands validates the
   token and lists the zones (root domains) it can manage.
3. Choose **Provision tunnel**. Docklands creates the tunnel at Cloudflare, stores
   its credentials encrypted, and starts the managed `cloudflared` container.

:::note
The API token is stored encrypted at rest and is never shown again or written to
logs. Scope it to only the zones you intend to use.
:::

## Expose a service

Once a tunnel is provisioned, exposing a service is the same as adding any
[domain](/networking/domains/), with the ingress mode set to **Cloudflare
Tunnel**:

1. Open an application or Compose service on the workspace canvas and go to its
   **Domains** section.
2. Add a host such as `app.yourdomain.com`. With Cloudflare connected, new
   domains default to **Cloudflare Tunnel**.
3. Save. Docklands creates a proxied DNS record pointing the host at the tunnel,
   and the service is reachable over HTTPS in seconds — no port, no certificate,
   no manual DNS.

The host must fall within one of the zones your token manages (e.g.
`app.yourdomain.com` needs `yourdomain.com` connected in Cloudflare). Removing
the domain deletes the DNS record again.

## Choosing the default for new domains

The ingress choice you make in **Setup** becomes the instance default applied to
new domains. You can still override it per domain in the **Add domain** dialog,
and you can run a mix — some domains via the tunnel, some via a public IP — on the
same server.

## Removing a tunnel

From **Domains → Cloudflare Tunnels**, **Remove tunnel** stops the managed
`cloudflared` container, deletes the tunnel at Cloudflare, and reverts any domains
that used it back to the public path. **Disconnect** removes the stored token but
leaves existing Cloudflare resources in place so you can reconnect later.

## Tips

- Tunnel mode finally gives IP-only installs an easy way to use a real hostname,
  which is also what [passkeys](/access/profile-and-security/) need.
- A wildcard DNS record (`*.yourdomain.com`) would let every new subdomain work
  with no per-domain API call, but proxied wildcard DNS requires a paid Cloudflare
  plan — Docklands creates per-host records by default.
