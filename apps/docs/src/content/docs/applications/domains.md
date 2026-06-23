---
title: Domains
description: Route HTTP/HTTPS traffic to an application through the Docklands ingress runtime.
---

A **domain** routes HTTP/HTTPS traffic to your application through the Docklands
ingress runtime (Traefik under the hood). This is the normal way to put a web app
or API online: you attach a hostname, choose a path and target port, and the
ingress runtime forwards matching requests to your container — with TLS if you
enable it.

You manage domains on the application's **Domains** tab. From there you can:

- **Add a domain** with a host, path, target port, and TLS/certificate settings.
- **Generate a domain** automatically — Docklands can hand you a working
  `traefik.me` hostname pointed at your server's IP, so you can test without owning
  a domain or configuring DNS.
- See per-domain **validation status**, including DNS hints when a record is not
  pointing where it should.

For HTTP-level extras tied to a domain, see the related application features:

- [Redirects](/applications/advanced/#redirects) — rewrite or forward request
  paths.
- [Security (basic auth)](/applications/security/) — password-protect the
  application at the edge.

## Full domain documentation

Domains have their own deep configuration — DNS setup, wildcard domains,
certificate resolvers (including Let's Encrypt), custom certificates, and ingress
behavior — covered in the networking section.

See **[Networking → Domains](/networking/domains/)** for the complete guide.

:::note
Domains route HTTP/HTTPS. To expose a raw TCP or UDP port (a database protocol, a
game server, gRPC), use [Ports](/applications/ports/) instead.
:::
