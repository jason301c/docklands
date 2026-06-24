# Implementation Details — Nav Restructure & Cloudflare Tunnels

**Status:** Implemented. Kept as the design record; the code under
`apps/docklands/` is the source of truth.

Companion to `beginner-first-nav-and-cloudflare-tunnels.md`. That doc is the
*what/why*; this is the *how* — file-by-file, grounded in the current code.

All paths are relative to `apps/docklands/`.

---

## Part A — Phase 1: Navigation restructure (frontend-only)

**Goal:** 22 navigable destinations → 4 top-level + a sectioned Settings, with
**zero new routes, zero backend, zero migrations.** Existing routes are
*regrouped*, not moved.

### A0. Key realization that keeps this cheap

`createMenuForAuthUser` already prunes a collapsible group when all its children
are filtered out (`shared/dashboard-nav.ts:257-261`):

```ts
if (item.isSingle === false) {
  const nestedItems = filterEnabled(item.items);
  if (nestedItems.length === 0) return filtered;   // group vanishes if empty
  filtered.push({ ...item, items: nestedItems });
  return filtered;
}
```

So the new **parent groups need no `isEnabled`** — they appear iff ≥1 child is
visible. Children keep their *existing* permission gates verbatim. This means
Phase 1 changes the *shape* of the menu but not a single permission rule, and the
existing test fixtures stay valid.

### A1. `shared/dashboard-nav.ts` — the new `DASHBOARD_MENU`

Imports: add `Globe` (Domains parent icon); remove `Tags` (no longer used in nav
— Tags moves to the command palette, A3). Everything else stays.

```ts
export const DASHBOARD_MENU: Menu = {
  // Top-level operating surfaces (rendered with no group label)
  home: [
    {
      isSingle: true,
      title: "Workspaces",
      url: "/dashboard/workspace",
      icon: House,
    },
    {
      isSingle: true,
      title: "Deployments",
      url: "/dashboard/deployments",
      icon: Rocket,
      isEnabled: ({ permissions }) => !!permissions?.deployment.read,
    },
    {
      isSingle: false,
      title: "Domains",
      icon: Globe,
      items: [
        {
          isSingle: true,
          title: "Ingress",
          url: "/dashboard/settings/ingress",
          icon: Activity,
          isEnabled: ({ permissions }) => !!permissions?.organization.update,
        },
        {
          isSingle: true,
          title: "Certificates",
          url: "/dashboard/settings/certificates",
          icon: ShieldCheck,
          isEnabled: ({ permissions }) => !!permissions?.certificate.read,
        },
        // Phase 2 inserts "Cloudflare Tunnels" here (see Part B).
      ],
    },
    {
      isSingle: false,
      title: "Monitoring",
      icon: BarChartHorizontalBigIcon,
      items: [
        {
          isSingle: true,
          title: "Container Runtime",
          url: "/dashboard/container-runtime",
          icon: BlocksIcon,
          isEnabled: ({ permissions }) => !!permissions?.docker.read,
        },
        {
          isSingle: true,
          title: "Cluster Runtime",
          url: "/dashboard/cluster-runtime",
          icon: PieChart,
          isEnabled: ({ permissions }) => !!permissions?.docker.read,
        },
        {
          isSingle: true,
          title: "Host Metrics",
          url: "/dashboard/host-metrics",
          icon: BarChartHorizontalBigIcon,
          isEnabled: ({ permissions }) => !!permissions?.monitoring.read,
        },
        {
          isSingle: true,
          title: "Ingress Requests",
          url: "/dashboard/requests",
          icon: Forward,
          isEnabled: ({ permissions }) => !!permissions?.docker.read,
        },
        {
          isSingle: true,
          title: "Ingress Files",
          url: "/dashboard/proxy-files",
          icon: GalleryVerticalEnd,
          isEnabled: ({ permissions }) => !!permissions?.traefikFiles.read,
        },
      ],
    },
  ],

  // Settings, rendered under a "Settings" group label
  settings: [
    {
      isSingle: false,
      title: "Team & Access",
      icon: Users,
      items: [
        {
          isSingle: true,
          title: "Users",
          url: "/dashboard/settings/users",
          icon: Users,
          isEnabled: ({ permissions }) => !!permissions?.member.read,
        },
        {
          isSingle: true,
          title: "Roles",
          url: "/dashboard/settings/roles",
          icon: ShieldCheck,
          isEnabled: ({ permissions }) => !!permissions?.member.read,
        },
        {
          isSingle: true,
          title: "Audit Log",
          url: "/dashboard/settings/audit-log",
          icon: ScrollText,
          isEnabled: ({ permissions }) => !!permissions?.auditLog.read,
        },
      ],
    },
    {
      isSingle: false,
      title: "Connections",
      icon: GitBranch,
      items: [
        {
          isSingle: true,
          title: "Git Providers",
          url: "/dashboard/settings/git-providers",
          icon: GitBranch,
          isEnabled: ({ permissions }) => !!permissions?.gitProviders.read,
        },
        {
          isSingle: true,
          title: "Image Registry",
          url: "/dashboard/settings/image-registry",
          icon: Package,
          isEnabled: ({ permissions }) => !!permissions?.registry.read,
        },
      ],
    },
    {
      isSingle: false,
      title: "Infrastructure",
      icon: Server,
      items: [
        {
          isSingle: true,
          title: "Runtime Workers",
          url: "/dashboard/settings/runtime",
          icon: Server,
          isEnabled: ({ permissions }) => !!permissions?.runtimeWorker.read,
        },
        {
          isSingle: true,
          title: "Build Workers",
          url: "/dashboard/settings/build-workers",
          icon: Boxes,
          isEnabled: ({ permissions }) => !!permissions?.runtimeWorker.read,
        },
        {
          isSingle: true,
          title: "Cluster Nodes",
          url: "/dashboard/settings/cluster-nodes",
          icon: Boxes,
          isEnabled: ({ permissions }) => !!permissions?.organization.update,
        },
        {
          isSingle: true,
          title: "SSH Keys",
          url: "/dashboard/settings/ssh-keys",
          icon: KeyRound,
          isEnabled: ({ permissions }) => !!permissions?.sshKeys.read,
        },
      ],
    },
    {
      isSingle: true,
      title: "Backups",
      url: "/dashboard/settings/storage",
      icon: Database,
      isEnabled: ({ permissions }) => !!permissions?.destination.read,
    },
    {
      isSingle: true,
      title: "Notifications",
      url: "/dashboard/settings/notifications",
      icon: Bell,
      isEnabled: ({ permissions }) => !!permissions?.notification.read,
    },
  ],

  help: [{ name: "Documentation", url: DOCS_URL, icon: BookIcon }],
};
```

**Notes / gotchas**

- `Build Workers` keeps gating on `runtimeWorker.read` (its current gate — there
  is no separate `buildWorker` statement).
- The old top-level `Ingress` used `organization.update`; preserved on the child.
- `Tags` (`tag.read`, route `/dashboard/settings/tags`) is removed from the
  menu. The route file stays; it becomes command-palette-only (A3).
- Active-state: `isActiveRoute` (`startsWith` + boundary char) already lights the
  parent collapsible when any child route matches, and `defaultOpen={isActive}`
  auto-expands it — so landing on `/dashboard/settings/users` opens **Team &
  Access**. No change needed.
- No route path collisions among the regrouped items (`/dashboard/settings/runtime`
  vs `/dashboard/container-runtime`, `/dashboard/settings/ingress` vs
  `/dashboard/requests`/`/dashboard/proxy-files` are all distinct prefixes).

### A2. `components/layouts/side.tsx` — group labels

The render loop (`NavMenuItems`) already handles single links *and* collapsible
groups, so only the three `SidebarGroupLabel`s change (`side.tsx:339-367`):

- Home group (`SidebarGroupLabel "Canvas"`): **drop the label** — primary nav
  reads cleaner unlabeled. (Render `<SidebarGroup><SidebarMenu>…` with no
  `SidebarGroupLabel`.) If a label is preferred, use "Overview".
- Settings group: `"Control Plane"` → **`"Settings"`**.
- Resources group: keep `"Resources"`.

No other change to `side.tsx`.

### A3. `components/dashboard/search-command.tsx` — keep Tags reachable

Tags leaves the sidebar but must not be orphaned. Add one entry to
`applicationItems` (`search-command.tsx:185`), matching the existing shape. This
also establishes the pattern: **rarely-used admin pages live in the command
palette, not the sidebar.**

```ts
{
  id: "app-tags-settings",
  title: "Tags",
  searchText: "settings tags labels organize services",
  onSelect: () => navigate("/dashboard/settings/tags"),
},
```

(Optional follow-up, not required for Phase 1: per `components/CLAUDE.md`,
`search-command` is a hardcoded parallel copy of the nav and *should* be derived
from `DASHBOARD_MENU`. Deriving it is a separate cleanup — out of scope here.)

### A4. `__test__/navigation/dashboard-nav.test.ts` — rewrite assertions

The current test is already stale (asserts a `"Profile"` settings entry that the
menu doesn't contain) and references the old flat list. Replace the structural
assertions with the new grouped shape. The `fullPermissions` fixture is unchanged
— every gate used above already appears in it.

Replace `menuTitles` + the first two `it` blocks with:

```ts
const groupTitles = (menu: Menu) => ({
  home: menu.home.map((i) => i.title),                 // top-level
  settings: menu.settings.map((i) => i.title),         // section headers
  domains: subItems(menu.home, "Domains"),
  monitoring: subItems(menu.home, "Monitoring"),
  teamAccess: subItems(menu.settings, "Team & Access"),
  connections: subItems(menu.settings, "Connections"),
  infrastructure: subItems(menu.settings, "Infrastructure"),
});

const subItems = (items: NavItem[], title: string) => {
  const group = items.find((i) => i.title === title);
  return group?.isSingle === false ? group.items.map((i) => i.title) : [];
};

it("groups the nav into beginner-first sections", () => {
  const menu = createMenuForAuthUser({ permissions: fullPermissions as any });
  expect(groupTitles(menu)).toEqual({
    home: ["Workspaces", "Deployments", "Domains", "Monitoring"],
    settings: ["Team & Access", "Connections", "Infrastructure", "Backups", "Notifications"],
    domains: ["Ingress", "Certificates"],
    monitoring: ["Container Runtime", "Cluster Runtime", "Host Metrics", "Ingress Requests", "Ingress Files"],
    teamAccess: ["Users", "Roles", "Audit Log"],
    connections: ["Git Providers", "Image Registry"],
    infrastructure: ["Runtime Workers", "Build Workers", "Cluster Nodes", "SSH Keys"],
  });
});

it("drops Tags from the sidebar (moved to command palette)", () => {
  const menu = createMenuForAuthUser({ permissions: fullPermissions as any });
  const allTitles = [
    ...menu.home.flatMap((i) => (i.isSingle === false ? [i.title, ...i.items.map((s) => s.title)] : [i.title])),
    ...menu.settings.flatMap((i) => (i.isSingle === false ? [i.title, ...i.items.map((s) => s.title)] : [i.title])),
  ];
  expect(allTitles).not.toContain("Tags");
});
```

Keep the existing `isActiveRoute` and `findActiveNavItem` tests (lines 100-132) —
`findActiveNavItem` still resolves `/dashboard/host-metrics` →
`"Host Metrics"` and `/dashboard/container-runtime` → `"Container Runtime"`,
now nested under **Monitoring** instead of **Runtime**, which the helper already
traverses.

### A5. Phase-1 checklist & verification

Files touched: `shared/dashboard-nav.ts`, `components/layouts/side.tsx`,
`components/dashboard/search-command.tsx`,
`__test__/navigation/dashboard-nav.test.ts`.

```sh
bun run format-and-lint:fix
bun run typecheck
bun run test:ci -- run __test__/navigation/dashboard-nav.test.ts   # or full test:ci
```

(Note: invoke vitest via the package script — it points at
`__test__/vitest.config.ts`, which defines the `@/` alias; running the `vitest`
binary directly fails to resolve `@/shared/...`.)

---

## Part B — Phase 2: Cloudflare Tunnels

**Architecture (from the plan):** one managed `cloudflared` container per server
with a **single catch-all ingress rule → `http://docklands-traefik:80`**,
`Host` header preserved. Traefik does host→container routing exactly as today.
Per-domain work is just a Cloudflare DNS CNAME. Tunnel-mode domains set
`certificateType = "none"` (CF terminates TLS; no ACME).

### B1. Data model

New schema module `server/core/db/schema/cloudflare.ts` (follow domain
conventions: `nanoid` text PKs, `createdAt` as ISO `text`, secrets via the
existing `encryptedText` helper from `server/core/db/encrypted.ts`):

```ts
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { encryptedText } from "@/server/core/db/encrypted";

export const cloudflareIntegration = pgTable("cloudflare_integration", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  apiToken: encryptedText("apiToken").notNull(),       // encrypted at rest
  accountId: text("accountId").notNull(),
  accountTag: text("accountTag").notNull(),
  zones: jsonb("zones").$type<{ id: string; name: string }[]>().notNull().default([]),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
});

export const tunnels = pgTable("tunnel", {
  tunnelId: text("tunnelId").primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  cfTunnelId: text("cfTunnelId").notNull(),            // Cloudflare's tunnel UUID
  token: encryptedText("token").notNull(),             // cloudflared run token
  runtimeWorkerId: text("runtimeWorkerId"),            // null = local server
  status: text("status").$type<"healthy" | "degraded" | "down" | "unknown">()
    .notNull().default("unknown"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
});
```

Additions to `server/core/db/schema/domain.ts`:

```ts
export const ingressMode = pgEnum("ingressMode", ["public", "tunnel"]);

// inside pgTable("domain", { ... }):
ingressMode: ingressMode("ingressMode").notNull().default("public"),
tunnelId: text("tunnelId").references(() => tunnels.tunnelId, { onDelete: "set null" }),
cfDnsRecordId: text("cfDnsRecordId"),   // for clean teardown of the CNAME
```

Instance default in `server/core/db/schema/web-server-settings.ts` (so
onboarding can set the blessed default):

```ts
defaultIngressMode: ingressMode("defaultIngressMode").notNull().default("public"),
```

**Migration:** this diff is **add-only** (two new tables + new columns, no drops),
so drizzle-kit will *not* fire the interactive create-vs-rename prompt — it's safe
to run in a non-TTY agent harness.

```sh
cd apps/docklands && bun run migration:generate   # then commit SQL + drizzle/meta
```

### B2. Cloudflare API client — `server/core/utils/cloudflare/client.ts`

Thin wrapper over `https://api.cloudflare.com/client/v4`. Throws on
`{ success: false }`. **Never logs the token**; treat as a security-sensitive
boundary (`server/core/utils/process/redactSecrets` if any command/stderr is
logged). Functions:

| fn | CF endpoint | purpose |
| --- | --- | --- |
| `verifyToken(token)` | `GET /user/tokens/verify` | validate on connect |
| `getAccount(token)` | `GET /accounts` | resolve accountId + tag |
| `listZones(token)` | `GET /zones` | the user's domains → `[{id,name}]` |
| `createTunnel(token, accountId, name)` | `POST /accounts/{id}/cfd_tunnel` `{name, config_src:"cloudflare"}` | remotely-managed tunnel |
| `getTunnelToken(token, accountId, cfTunnelId)` | `GET …/cfd_tunnel/{id}/token` | run token for `cloudflared` |
| `putTunnelConfig(token, accountId, cfTunnelId, ingress)` | `PUT …/cfd_tunnel/{id}/configurations` | catch-all → Traefik |
| `upsertDnsCname(token, zoneId, name, target)` | `POST/PUT /zones/{id}/dns_records` `{type:"CNAME", proxied:true}` | per-host record |
| `deleteDnsRecord(token, zoneId, recordId)` | `DELETE /zones/{id}/dns_records/{rid}` | teardown |
| `deleteTunnel(token, accountId, cfTunnelId)` | `DELETE …/cfd_tunnel/{id}` | teardown |

The catch-all ingress payload for `putTunnelConfig`:

```jsonc
{ "config": { "ingress": [
  { "service": "http://docklands-traefik:80" }   // single catch-all
] } }
```

DNS target for `upsertDnsCname`: `<cfTunnelId>.cfargotunnel.com`, `proxied:true`.

### B3. Services

`server/core/services/cloudflare.ts`:
- `connectCloudflare(apiToken)` — `verifyToken` → `getAccount` → `listZones` →
  upsert the single `cloudflare_integration` row (encrypted token).
- `getCloudflareIntegration()` / `disconnectCloudflare()` / `refreshZones()`.

`server/core/services/tunnel.ts`:
- `provisionTunnel({ name, runtimeWorkerId? })` — `createTunnel` →
  `getTunnelToken` → insert `tunnel` row → `putTunnelConfig` (catch-all) →
  `startCloudflared(token)` (B4).
- `ensureTunnelRunning()` / `teardownTunnel(tunnelId)` / `getTunnelStatus()`.
- `attachDomainToTunnel(domain)` — pick the zone whose `name` is a suffix of
  `domain.host`; `upsertDnsCname` → persist `cfDnsRecordId`, set
  `ingressMode="tunnel"`, `tunnelId`, `certificateType="none"`.
- `detachDomainFromTunnel(domain)` — `deleteDnsRecord(zoneId, cfDnsRecordId)`.

### B4. Managed `cloudflared` runtime — `server/core/setup/cloudflared-setup.ts`

Mirror `server/core/setup/traefik-setup.ts` (which already does both a local
`docker.createContainer` path and a Swarm `docker.createService` path). For
`cloudflared`:

- image `cloudflare/cloudflared:${CLOUDFLARED_VERSION}` (pin a version constant
  alongside `TRAEFIK_VERSION`).
- name `docklands-cloudflared`; attach to `docklands-network`.
- **No published ports** (outbound-only) and **no docker.sock mount** (it only
  needs network DNS to reach `docklands-traefik`).
- command `["tunnel", "--no-autoupdate", "run"]`; pass the run token via the
  **`TUNNEL_TOKEN` env var, not argv**, so it doesn't appear in `ps`/cmdline.
- functions: `startCloudflared(token)`, `stopCloudflared()`,
  `recreateCloudflared(token)` — same create/remove/recreate shape as
  `traefik-setup`.

### B5. tRPC routers + permissions

Add a `tunnel` resource to `server/core/lib/access-control.ts`:

```ts
// statements:
tunnel: ["read", "create", "delete"],
// ownerRole + adminRole: tunnel: ["read", "create", "delete"]
// memberRole: tunnel: []   (org-level, like certificate/registry/destination)
```

(Adding to `statements` + the three static roles is enough; `PermissionsOutput`
is derived from the router, so `permissions.tunnel.read` becomes available to nav
gates automatically.)

Routers (keep thin: validate → permission → audit → service):
- `server/api/routers/cloudflare.ts` — `connect` (`adminProcedure`, token input),
  `get`/`status` (`withPermission("tunnel","read")`), `disconnect`, `listZones`.
- `server/api/routers/tunnel.ts` — `provision` / `status` / `teardown`.
- Register both in `server/api/root.ts`.

### B6. Wire into the domain lifecycle

In `server/core/services/domain.ts`:
- `createDomain` (line 18): after the insert, branch on mode. **Always** call
  `manageDomain` (Traefik still routes by host — in tunnel mode with
  `certificateType="none"`, so no ACME). **Additionally**, when
  `ingressMode==="tunnel"`, call `attachDomainToTunnel(domain)` to create the
  CNAME.
- `removeDomainById` (line 130): when `domain.ingressMode==="tunnel"`, call
  `detachDomainFromTunnel(domain)` (delete the CNAME) alongside the existing
  Traefik cleanup.
- Add `ingressMode` (optional, defaulting to instance `defaultIngressMode`) to
  the `apiCreateDomain` input schema.

### B7. UI

- **Cloudflare settings page** under the **Domains** nav group — new item in
  `DASHBOARD_MENU.home → Domains.items` (the placeholder noted in A1):
  `{ title: "Cloudflare Tunnels", url: "/dashboard/settings/cloudflare",
  icon: Globe, isEnabled: ({permissions}) => !!permissions?.tunnel?.read }`,
  plus the route `app/dashboard/settings/cloudflare/page.tsx` +
  `components/dashboard/settings/cloudflare/`. Connect-token form, zone list,
  tunnel status badge.
- **Per-service "Add domain"** (`components/dashboard/application/domains/show-domains.tsx`):
  add an ingress-mode toggle (**Cloudflare Tunnel** / **Public IP**), defaulting
  to the instance default. In tunnel mode, hide the cert/Let's-Encrypt fields
  (forced to `none`) and the "point your A record at <ip>" hint.

### B8. Startup bootstrap

`server/server.ts` already bootstraps Traefik/Swarm/network in production. Add:
"if a `tunnel` row exists, `ensureTunnelRunning()`" right after the Traefik
bootstrap, so the `cloudflared` container is restored on restart.

### B9. Phase-2 files

New: `db/schema/cloudflare.ts`, `utils/cloudflare/client.ts`,
`services/cloudflare.ts`, `services/tunnel.ts`, `setup/cloudflared-setup.ts`,
`api/routers/cloudflare.ts`, `api/routers/tunnel.ts`,
`app/dashboard/settings/cloudflare/page.tsx`,
`components/dashboard/settings/cloudflare/*`, a drizzle migration.
Edited: `db/schema/domain.ts`, `db/schema/web-server-settings.ts`,
`lib/access-control.ts`, `api/root.ts`, `services/domain.ts`,
`shared/validations/domain.ts`, `components/dashboard/application/domains/show-domains.tsx`,
`shared/dashboard-nav.ts`, `server/server.ts`.

---

## Part C — Phase 3: Onboarding wizard

- Post-bootstrap gate: after the single-owner registration
  (`app/(onboarding)/`), if `webServerSettings.defaultIngressMode` is still the
  default and no ingress is configured, route to a one-question wizard.
- **"How should people reach your apps?"** → *Cloudflare Tunnel (recommended)*
  runs the connect-token + `provisionTunnel` flow and sets
  `defaultIngressMode="tunnel"`; *Public IP (advanced)* collects host/IP +
  `certificateType` and sets `defaultIngressMode="public"`.
- Then deep-link to "deploy your first app" (template or GitHub); the created
  service's first domain inherits the default mode and is live over HTTPS.

---

## Part D — Sequencing & risks

1. **Phase 1** ships alone (frontend-only, no migration) — biggest visible win.
2. **Phase 2** is the differentiator; its only schema change is add-only
   (agent-safe migration).
3. **Phase 3** ties it together.

Risks / decisions still open (also in the plan's §12):
- Wildcard DNS needs a paid CF plan → v1 ships per-host CNAMEs.
- `cloudflared` as Swarm service vs. plain container on multi-node.
- Public↔tunnel mode switch must clean up the prior mode's artifacts (ACME cert
  vs. CF DNS record).
- Naming: **Infrastructure** is used here for the servers/workers section to
  respect the `AGENTS.md` vocabulary rule that reserves "server" as a product
  noun. Switch to **Servers** only if we also update that rule.
