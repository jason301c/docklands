---
title: TLS Certificates
description: Provision HTTPS with Let's Encrypt, upload your own certificates, and understand where Docklands stores TLS material.
---

Docklands terminates TLS at its [Traefik ingress runtime](/networking/ingress/).
There are two ways to get a certificate onto a domain: let Traefik obtain one
automatically from **Let's Encrypt**, or **upload your own** certificate files.
This page covers both, plus where certificates are stored and the limits worth
knowing before you go to production.

## Let's Encrypt (automatic)

When you enable HTTPS on a [domain](/networking/domains/#serve-over-https) and
pick **Let's Encrypt** as the provider, Docklands writes a Traefik router with
`tls.certResolver: letsencrypt`. Traefik then requests and renews the certificate
for you using the ACME **HTTP-01 challenge**.

For the challenge to succeed:

- The domain's DNS must already point at your server (an A record to your
  ingress IP). Provision DNS *before* enabling Let's Encrypt.
- Ports `80` and `443` must be reachable from the public internet — HTTP-01
  validates over port 80.
- The host must be a real, resolvable domain. `sslip.io` test domains are HTTP
  only and cannot get a Let's Encrypt certificate.

The shared `letsencrypt` resolver is defined in the Traefik static config and
stores its account and issued certificates in `acme.json` inside the dynamic
config directory.

:::caution
**The default ACME contact email is a placeholder (`test@localhost.com`).** It is
only replaced with a real address when you set a **Let's Encrypt Email** under
[ingress settings](/networking/ingress/#ingress-settings) (the Ingress Domain
form). Set a real email there before relying on Let's Encrypt — it is where
expiry and policy notices are sent, and a bogus address can cause issuance to be
refused.
:::

:::caution
**Let's Encrypt enforces rate limits.** Repeatedly toggling HTTPS, redeploying
while DNS is misconfigured, or testing against many subdomains can exhaust the
weekly issuance limit for a registered domain and lock you out of new
certificates for that domain for up to a week. While iterating, prefer an
`sslip.io` test domain or Let's Encrypt's staging environment, and only switch a
real host to Let's Encrypt once its DNS and ports are confirmed working.
:::

:::note
The `letsencrypt` resolver is only wired into the Traefik static config when
Docklands runs in production (`NODE_ENV=production`). In local/light development
the resolver is omitted, so Let's Encrypt will not issue certificates against a
laptop dev instance.
:::

### Wildcard and DNS challenges

The built-in resolver uses the **HTTP-01** challenge, which **cannot issue
wildcard certificates** (`*.example.com`). Wildcards require the DNS-01 challenge
with a provider credential. Docklands does not configure a DNS-01 resolver for
you; if you need wildcards you must add your own resolver to the Traefik static
config (see [editing Traefik config](/networking/ingress/#editing-traefik-config))
and reference it as a [Custom certificate resolver](/networking/domains/#serve-over-https)
on the domain.

## Upload a custom certificate

If you already hold a certificate (from your own CA, a paid provider, or an
internal PKI), upload it under **Settings → Certificates**
(`/dashboard/settings/certificates`). Click **Add Certificate** and provide:

- **Certificate Name** — a label for your reference.
- **Certificate Data** — the PEM certificate, including the full chain
  (`-----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----`). The UI parses the
  chain and shows the leaf common name and per-certificate expiry.
- **Private Key** — the matching PEM private key.
- **Placement** *(optional, only shown when remote runtime workers exist)* — pin
  the certificate to a specific runtime worker, or leave it on **Automatic
  placement** for the local ingress runtime.

On save, Docklands writes `chain.crt`, `privkey.key`, and a small
`certificate.yml` (a Traefik dynamic TLS config that points at those files) into
the certificates directory. Traefik watches that directory and serves the
certificate by **SNI** — it matches the hostname in the TLS handshake against the
certificate's subject/SAN, so you do not bind the certificate to a specific
domain in the UI.

To use an uploaded certificate on a domain, enable HTTPS and set the certificate
provider to **None** (not "Custom"). "Custom" refers to an ACME *resolver* name,
which is a different mechanism — see the
[caution in the Domains guide](/networking/domains/#serve-over-https).

:::caution
**Private keys are written as plain files for the ingress runtime.** In the
Docklands database the certificate data and private key are
[encrypted at rest with AES-256-GCM](/install/configuration/#secrets-at-rest),
but Traefik needs the material in the clear to serve TLS, so it is also written
as plain files into the ingress runtime directory (under `/etc/docklands`).
Protect filesystem access accordingly, back up
[`DOCKLANDS_ENCRYPTION_KEY`](/install/operations/#back-up-the-control-plane-itself)
with your database dumps, and prefer short-lived certificates you can rotate.
Only owners/admins (or members granted the `certificate` permission) can view,
create, or delete certificates, and certificates are scoped to your
organization.
:::

### Editing and removing certificates

- **Edit** a certificate to change its name, certificate data, or private key. If
  the data or key changes, the on-disk files are rewritten.
- **Delete** a certificate to remove both the database row and its files from the
  ingress runtime directory.

:::note
The list shows an **Auto-renewal enabled** badge when a certificate is flagged
for auto-renewal, but uploaded custom certificates are not renewed by Docklands —
only Let's Encrypt certificates renew automatically (handled by Traefik). Treat
uploaded certificates as something you rotate yourself before expiry.
:::

## Where certificates live

| What | Location |
| --- | --- |
| Let's Encrypt account + issued certs | `acme.json` in the Traefik dynamic config directory (mode `600`) |
| Uploaded custom certs | `chain.crt` / `privkey.key` / `certificate.yml` under the certificates directory |

In production these sit under `/etc/docklands/traefik/dynamic`; in local
development they sit under `.docker/traefik/dynamic` in the project directory.
Both are bind-mounted into the `docklands-traefik` container. You can browse the
generated files (but not the raw `acme.json` private material through the editor)
via [proxy files](/networking/ingress/#editing-traefik-config).
