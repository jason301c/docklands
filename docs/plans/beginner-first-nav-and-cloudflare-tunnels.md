# Beginner-First Navigation & Cloudflare Tunnels

**Status:** Implemented (nav restructure, Cloudflare Tunnels, first-run ingress onboarding). Kept as the design record / rationale.
**Scope:** Information architecture of the dashboard + Cloudflare Tunnels as a
first-class ingress mode + a first-run onboarding wizard.
**Audience:** Whoever builds the next iteration of the control-plane shell.

---

## 1. Thesis

Dokploy and Coolify make the same mistake: **they expose the implementation as
the interface.** "SSH Keys", "Image Registry", "Certificates", "Cluster Nodes",
"Build Workers", "Roles" are things the *system* needs, not things a *person*
wants. A beginner doesn't wake up wanting to configure an image registry; they
want to put an app online.

Docklands has a structural advantage the others don't: **no users, no compat
debt** (see root `AGENTS.md` → "Pre-Release, No Compatibility Debt"). We are free
to choose the cleanest end state instead of preserving Dokploy's surface area.

The governing rule for everything below:

> The sidebar should reflect **what people do**, not **what the system has**.
> Infrastructure primitives get auto-provisioned with smart defaults and stay
> hidden until the default breaks.

And the wedge that makes "the friendliest way to self-host" *true* rather than
aspirational is **Cloudflare Tunnels as the default path to "online"** — it
deletes ports, public-IP requirements, manual DNS, and cert management in one
move.

---

## 2. Audience & opinionated principles

Target user: a self-hoster with **one VM** (a cheap VPS or a home server),
deploying a web app from GitHub plus maybe a database, who is scared of DNS,
ports, firewalls, TLS, and reverse proxies. This is the **median** user, and the
product should be designed for them, with power-user depth available but not in
the way.

Principles:

1. **Tasks, not primitives.** Top-level nav = verbs/nouns a person cares about
   (Projects, Deployments, Domains, Monitoring). Primitives (keys, registries,
   certs, nodes) live behind Settings.
2. **One concept = one place.** Today "machines" is split across *Build Workers*,
   *Runtime Workers*, and *Cluster Nodes*; "ingress" is split across *Ingress*,
   *Ingress Requests*, and *Ingress Files*. Each concept gets exactly one home.
3. **Smart defaults over configuration.** Auto-generate the instance SSH key,
   ship default roles, manage certs automatically. Surface config only when the
   default is insufficient.
4. **Progressive disclosure.** One Settings area with sections, not 13 flat items
   plus a 6-item submenu.
5. **One blessed path to "online".** Cloudflare-Tunnel-first, with the classic
   public-IP/Traefik path available for power users.

---

## 3. Current state (grounded)

Single source of truth for nav: `apps/docklands/shared/dashboard-nav.ts`
(`DASHBOARD_MENU`), rendered by `apps/docklands/components/layouts/side.tsx`. It
has three groups:

- **`home`** (2): Workspaces, Deployments.
- **`settings`** (13 flat + 1 collapsible): Ingress, Build Workers, Users, Roles,
  Audit Log, SSH Keys, Tags, Git Providers, Image Registry, Storage,
  Certificates, Cluster Nodes, Notifications, and a **Runtime** submenu of 6:
  Runtime Workers, Container Runtime, Cluster Runtime, Ingress Requests, Ingress
  Files, Host Metrics.
- **`help`** (1): Documentation.

That's **~22 navigable destinations**, most of them infrastructure primitives,
flattened into a single scroll. The fragmentation is the real problem:

| Concept | Scattered across today |
| --- | --- |
| Machines / compute | Build Workers · Runtime Workers · Cluster Nodes |
| Ingress / networking | Ingress · Ingress Requests · Ingress Files · Certificates |
| Team / access | Users · Roles · Audit Log |
| External connections | Git Providers · Image Registry · SSH Keys |
| Observability | Container Runtime · Cluster Runtime · Host Metrics |

Each cluster above is one idea wearing three or four hats.

---

## 4. Target information architecture

22 destinations → **4 top-level + a sectioned Settings**.

```
  Docklands  v0.29.8

  ━━ MAIN ━━
  🏠  Projects            (was "Workspaces")
  🚀  Deployments
  🌐  Domains             ← Ingress + Certificates + Cloudflare Tunnels
  📊  Monitoring          ← Container Runtime + Cluster Runtime + Host Metrics + Ingress Requests/Files

  ⚙️  Settings            (sectioned, see §6)
       ├ Team & Access      (Users · Roles · Audit Log)
       ├ Connections        (Git Providers · Image Registry)
       ├ Servers            (this server · Cluster Nodes · Build/Runtime Workers · SSH Keys)
       ├ Backups            (Storage destinations)
       └ Notifications

  📖  Documentation        (footer link, unchanged)
```

Everything a beginner touches in week one is in the top group. Everything else is
one click into Settings — discoverable, not in the face.

**Net config a beginner ever performs:** connect Cloudflare (or choose public
IP), connect GitHub, deploy. Everything else auto-provisions.

### Implementation note

`DASHBOARD_MENU` already supports nested items (`isSingle: false` +
`items[]`) and per-item permission gates (`isEnabled`). The restructure is mostly
a **data change in `shared/dashboard-nav.ts`** plus making the Settings group
render as sections. `side.tsx`'s `NavMenuItems` already renders collapsible
groups, so Settings-as-sections is largely reuse. New routes are not required for
phase 1 — existing routes (`/dashboard/settings/*`, `/dashboard/container-runtime`,
etc.) get **regrouped**, not moved. (Page moves can follow later; keep
`next.config.mjs` free of legacy redirects per app `AGENTS.md`.)

---

## 5. Item-by-item disposition

| Current item | What it really is | Verdict | New home |
| --- | --- | --- | --- |
| Workspaces | Projects / canvas | Keep top-level (consider rename → **Projects**) | MAIN |
| Deployments | Activity / history feed | Keep top-level | MAIN |
| Ingress | Traefik proxy config | Fold | **Domains** (advanced tab) |
| Certificates | TLS certs | Automate + fold (invisible 95% of the time) | **Domains** (advanced tab) |
| Ingress Requests | Live request inspector | Fold | **Monitoring** |
| Ingress Files | Raw Traefik YAML | Fold | **Domains** → advanced, or Monitoring |
| Git Providers | GitHub/GitLab connections | Fold | Settings → **Connections** |
| Image Registry | Docker registries | Fold | Settings → **Connections** |
| SSH Keys | Git/server credentials | Auto-generate + hide | Settings → **Servers** (advanced) |
| Storage | Backup destinations (S3) | Rename → **Backups** | Settings → **Backups** |
| Users | Team members | Merge | Settings → **Team & Access** |
| Roles | Permissions (currently empty) | Merge + ship defaults; hide until a custom role exists | Settings → **Team & Access** |
| Audit Log | Compliance trail | Merge; hide for solo installs | Settings → **Team & Access** |
| Cluster Nodes | Multi-machine swarm | Hide for single-VM | Settings → **Servers** (advanced) |
| Build Workers | Remote build machines | Hide for single-VM | Settings → **Servers** (advanced) |
| Runtime Workers | Remote runtime machines | Hide for single-VM | Settings → **Servers** (advanced) |
| Tags | Service metadata | Demote to inline in Projects | (not a nav item) |
| Notifications | Alerts | Move | Settings → **Notifications** |
| Container Runtime | Containers on the host | Regroup | **Monitoring** |
| Cluster Runtime | Cluster-wide containers | Regroup | **Monitoring** |
| Host Metrics | CPU/mem/disk | Regroup | **Monitoring** |
| Documentation | External link | Keep | footer |

### Notes on the sharper merges

- **Users + Roles + Audit Log → "Team & Access".** They're not literally
  redundant (who vs. what-they-can-do vs. what-happened), but for a solo
  self-hoster — the median user — all three are noise. One Team page: a member
  list with an inline role dropdown, three built-in roles (Owner / Admin /
  Read-only — these already exist as static roles in
  `server/core/lib/access-control.ts`), and "custom roles" behind a link most
  people never click. The empty Roles screen in the wild (`"No custom roles
  yet"`) is the tell that it's an advanced feature in prime real estate.
- **The three "workers/nodes" → one "Servers" section.** Build Workers, Runtime
  Workers, and Cluster Nodes are all "machines that build or run your stuff." For
  a single-VM install this is one machine (this server) and the section is mostly
  empty/auto. Power users add nodes/workers here. (Naming caveat in §10.)
- **Tags is not a destination.** Tagging happens inline on a service in the
  Projects canvas; a global management table, if needed at all, is a small panel,
  not top-level nav.

---

## 6. Settings, sectioned

Render the `settings` group as labeled sub-sections (collapsible groups already
exist in `side.tsx`). Default open: none — Settings is a place you go, not a place
you live.

- **Team & Access** — members, role assignment, custom roles (advanced), audit
  log (hidden when membership == 1).
- **Connections** — Git providers (GitHub/GitLab/Gitea), image registries.
- **Servers** — this server (always present), additional cluster nodes, build &
  runtime workers, SSH keys (auto-generated default + custom). Empty-but-for-this-
  server on a fresh single-VM install.
- **Backups** — S3-compatible destinations (today's "Storage").
- **Notifications** — providers + which events notify (also the transactional
  email provider per app `AGENTS.md` → `system-email.ts`).

---

## 7. Cloudflare Tunnels — first-class ingress

This is the differentiator. It is not "a feature"; it is **the default way a
beginner gets online.**

### 7.1 Why (the pitch)

The classic path (today's only path) requires the user to: point a DNS A record
at the server IP, open ports 80/443, survive NAT/CGNAT/ISP/firewall, and let
Traefik win a Let's Encrypt challenge. Every step is a place a beginner fails.

A Cloudflare Tunnel (`cloudflared`, outbound-only) deletes all of them:

- **No open ports** — the connection is outbound; the firewall stays shut.
- **No public IP** — works on a home server behind NAT/CGNAT, not just a VPS.
- **No manual DNS** — Docklands creates the CNAME via the Cloudflare API.
- **No cert management** — Cloudflare terminates TLS at the edge, free,
  auto-renewed. We can disable Let's Encrypt entirely in tunnel mode.
- Free CDN + DDoS protection as a bonus.

It is *strictly easier* than the IP path for our audience, so it should be the
**default**, not an option buried in settings.

### 7.2 Architecture decision (the important one)

**Route the tunnel into the existing Traefik, not directly to containers.**

```
Internet ─► Cloudflare edge (TLS terminates here)
              │  outbound tunnel (encrypted)
              ▼
          cloudflared container  ── on docklands-network ──►  Traefik  ──►  service container
                                       (single catch-all                (host-based routing,
                                        ingress → traefik:80)            exactly as today)
```

`cloudflared` runs as a Docklands-managed container on the `docklands-network`
overlay with **one** catch-all ingress rule → `http://docklands-traefik:80`,
preserving the `Host` header. Traefik then does the host-based routing it already
does (see `server/core/utils/traefik/*`, which generate ingress YAML on disk).

**Why this is the right call:** the entire per-service domain/routing model stays
*exactly as it is today*. The `domain` table (`server/core/db/schema/domain.ts`:
`host`, `port`, `path`, `middlewares`, `stripPath`, …) and all the Traefik file
generation are reused untouched. A Cloudflare Tunnel only changes **how traffic
enters**, not **how it is routed**. You are adding an entrypoint, not rewriting
ingress. And because the cloudflared→Traefik hop is internal, Traefik can speak
plain HTTP there — so in tunnel mode `certificateType` is `none` (the enum
already supports `letsencrypt | none | custom` in
`server/core/db/schema/shared.ts`) and one whole failure mode (ACME) disappears.

Rejected alternative: cloudflared routing per-service directly to containers.
Simpler to picture, but it abandons Traefik's routing/middleware and forces
per-service ingress-rule management — more work, less reuse.

### 7.3 Use remotely-managed (token) tunnels

Don't write `cloudflared` config files to disk. Run
`cloudflared tunnel run --token <token>` and manage **ingress + DNS via the
Cloudflare API**. Nothing to sync to the box; the tunnel's config lives at
Cloudflare and is driven by our API calls. Cleaner ops, fits the "no direct
Traefik API, generate-and-go" spirit without adding on-disk tunnel state.

### 7.4 Data model

Follow domain conventions: `text` nanoid PKs, `createdAt` as ISO `text`
(`apps/docklands/server/core/db/schema/`), encrypted secrets via the existing
encryption-key path.

- **`cloudflare_integration`** — `id`, encrypted `apiToken`, `accountId`, cached
  `zones` (jsonb), `createdAt`. One per instance (single-tenant).
- **`tunnel`** — `id`, `name`, Cloudflare `cfTunnelId`, encrypted
  `tunnelToken`/credentials, the server/node it runs on, `status`, `createdAt`.
  Default: one tunnel per server.
- **`domain` additions** — `ingressMode` pgEnum `["public", "tunnel"]` default
  `"public"`; nullable `tunnelId` FK; nullable `cfDnsRecordId` (so teardown can
  delete the DNS record). When `ingressMode = "tunnel"`, force
  `certificateType = "none"`.

Generate the Drizzle migration + `drizzle/meta` snapshot per the migration rule
(root `AGENTS.md`). No backfill needed (no users).

### 7.5 Backend surface

- **`server/core/utils/cloudflare/`** — a thin CF API client: validate token,
  list zones, create tunnel, fetch tunnel token, upsert DNS CNAME
  (`<host> → <cfTunnelId>.cfargotunnel.com`, proxied), delete DNS record,
  configure tunnel ingress (catch-all → Traefik). Treat the token like any other
  secret (never logged; redaction per `utils/process`).
- **`server/core/services/cloudflare.ts` + `services/tunnel.ts`** — connect/
  validate integration; provision/teardown tunnel; start/stop the managed
  `cloudflared` container (reuse the docker/process utils that manage Traefik);
  attach/detach a domain (create/delete the CNAME + flip `ingressMode`).
- **tRPC**: `api.cloudflare` (integration) + `api.tunnel` (lifecycle). Keep
  routers thin; audit mutations to the `audit-log` table.
- **Permissions**: add a `tunnel` resource (or reuse the ingress/`traefikFiles`
  gate) to the `statements` in `server/core/lib/access-control.ts`.
- **Runtime**: a managed `cloudflared` Swarm service/container per server,
  started with `--token`, attached to `docklands-network`. Health surfaced in the
  Domains page. Bootstrap alongside Traefik in the production startup sequence
  (`server/server.ts`) when a tunnel is configured.

### 7.6 UX flow

1. **Connect Cloudflare (once)** — in Domains (or onboarding): paste a scoped API
   token (Account: *Cloudflare Tunnel Edit*; Zone: *DNS Edit*). Validate, list
   zones (the domains they own on CF).
2. **Provision tunnel** — Docklands creates a named tunnel via the API, stores
   credentials encrypted, starts the managed `cloudflared` container.
3. **Expose a service** — in a service's panel, **Add domain** → type
   `app.theirdomain.com` (subdomain auto-suggested). Docklands creates the CF DNS
   CNAME and the service is live over HTTPS in seconds. No port, no cert, no
   manual DNS.
4. **Status** — tunnel health (connected/degraded) + per-domain reachability in
   the Domains page.

### 7.7 Modes, coexistence, fallback

- Two ingress modes coexist per domain: **tunnel** (default, recommended) and
  **public** (Traefik on 80/443 + Let's Encrypt + A record — today's behavior).
- A server may mix modes (some domains tunneled, some public), but tunnel is the
  default.
- **Auto-detect & steer:** if the server has no public IP or ports 80/443 are
  unreachable, *force* tunnel mode and don't offer the harder path.
- **Stretch:** a wildcard `*.theirdomain.com → tunnel` CNAME makes every new app
  get a subdomain instantly with zero per-app API calls — but proxied wildcard
  DNS requires a paid Cloudflare plan, so ship per-hostname records first and
  treat wildcard as an upgrade.

### 7.8 Security notes

- API token stored encrypted; never logged (redaction at the process boundary).
- Token scope guidance surfaced in the UI (least privilege: Tunnel Edit + DNS
  Edit on the chosen zone only).
- Tunnel credentials are secrets; treat the new service/router as a
  security-sensitive boundary (test-worthy per `AGENTS.md`).
- Passkeys are host-bound (RP id from `BETTER_AUTH_URL`); tunnel mode finally
  gives IP-only installs an easy way to get a real hostname, which *improves* the
  passkey story — call this out in docs.

---

## 8. First-run onboarding wizard

Today `app/(onboarding)/` holds the auth flows and the first registrant becomes
the single owner (`AGENTS.md` → single-tenant bootstrap). Add a post-bootstrap
wizard gate that runs once when no ingress is configured.

One decisive question: **"How should people reach your apps?"**

- **Cloudflare Tunnel (recommended)** — "No ports, no DNS setup, free HTTPS.
  Works on home servers and any VPS." → paste token, pick domain.
- **Public IP (advanced)** — the classic A-record + ports + Let's Encrypt path.

Then: deploy the first app from a template or GitHub → it auto-gets
`app.theirdomain.com`. A working, HTTPS-served app in ~3 clicks. *That* is the
"friendliest way to self-host" claim, made real.

---

## 9. Defaults & auto-provisioning

These make the hidden Settings items safe to hide:

- **SSH keys** — auto-generate a default instance keypair during setup; the SSH
  Keys screen only matters for custom keys.
- **Roles** — `owner`/`admin`/`member` already exist as static roles; ship them,
  and hide the custom-role UI until someone creates one.
- **Certificates** — default to automatic: `none` (CF edge) in tunnel mode,
  Let's Encrypt in public mode. Certificate management appears only for custom
  certs.
- **Audit log** — hide for solo installs (membership == 1); reveal when a second
  member exists.
- **Servers** — "this server" always present and healthy by default; node/worker
  management is opt-in.

---

## 10. Naming reconciliation (decision needed)

App `AGENTS.md` defines a product vocabulary that partially conflicts with the
beginner-friendliest labels. Flagging the tensions so they're decided
deliberately, not by accident:

| Beginner-friendly label | `AGENTS.md` vocabulary | Recommendation |
| --- | --- | --- |
| **Projects** (top-level) | established term is "Workspaces" | Lean Projects (universal); acceptable to keep Workspaces. Low stakes. |
| **Domains** (top-level) | prefers "ingress" as the product noun | Use **Domains** for the beginner-facing surface; keep "ingress" for the advanced/technical tab + engine names. |
| **Servers** (Settings section) | reserves "server" for engine identifiers; prefers worker/cluster | Either override for clarity (**Servers**) or use **Infrastructure**. Recommend **Servers** for beginners. |

If we adopt these, update the "Product vocabulary" section of
`apps/docklands/AGENTS.md` in the same change so the docs stay the contract.

---

## 11. Build sequencing

1. **Sidebar IA restructure** *(frontend-only, low risk, biggest visible win)* —
   rewrite `shared/dashboard-nav.ts` to the §4 structure; render Settings as
   sections in `side.tsx`; add the auto-provision defaults from §9 so hidden
   items have sane defaults. No backend, no migrations. Sets the frame everything
   else slots into.
2. **Cloudflare Tunnels** *(the differentiator)* — data model (§7.4) + CF client/
   services (§7.5) + managed `cloudflared` runtime + the Domains page + wire into
   the per-service "Add domain" flow.
3. **Onboarding wizard** *(ties it together)* — the ingress-mode choice + guided
   first deploy.

Each phase is independently shippable. Phase 1 alone already makes the product
feel dramatically simpler; phase 2 is what makes it *different*.

---

## 12. Open questions / risks

- **Wildcard DNS** needs a paid CF plan — confirm we're happy shipping
  per-hostname records as the v1 and gating wildcard as an upgrade.
- **`cloudflared` lifecycle** under Swarm: confirm it should run as a Swarm
  service (HA-ish) vs. a plain container, and how it behaves on multi-node.
- **Mixed-mode edge cases**: a domain switched public↔tunnel must clean up the
  prior mode's artifacts (ACME cert vs. CF DNS record).
- **Token UX**: a paste-a-token flow is simplest; a future Cloudflare OAuth flow
  would be friendlier but is more work — out of scope for v1.
- **Monitoring as top-level vs. in-canvas**: keeping it top-level is the
  recommendation, but it could collapse into per-service views if we want only
  three top-level items.
