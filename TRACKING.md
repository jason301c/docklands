# Docklands Transformation Tracker

This file tracks the ongoing move from the inherited Dokploy admin dashboard to a polished Railway-inspired, self-hosted Docklands project canvas. Keep it current when committing meaningful product, architecture, migration, or verification work.

## Current Baseline

- Branch: `canary`
- Latest checkpoint: Rehome service ingress config UI
- Product direction: self-hosted VM control plane, not hosted Docklands-as-a-service.
- Primary app: `apps/docklands`, a Next.js 16 App Router app with a colocated backend under `server/`.
- Canonical workspace entry: `/dashboard/workspace`
- Canonical environment route: `/dashboard/workspace/[projectId]/[environmentId]`
- Canonical service route: `/dashboard/workspace/[projectId]/[environmentId]/service/[serviceType]/[serviceId]`
- Compatibility routes still exist for old `/dashboard/project/...` links.

## Done

- Forked upstream, renamed product and runtime resources toward Docklands.
- Removed proprietary/source-available upstream app surfaces and AI dependencies/plumbing.
- Removed Swagger UI while keeping OpenAPI generation and runtime API support.
- Moved to a single `apps/docklands` app layout with no `packages/` split.
- Added nested `AGENTS.md` files and clarified app/server/tools boundaries.
- Updated dependencies to the current major stack, including Next 16, React 19, TypeScript 6, Tailwind 4, Biome 2, tRPC 11, and Vitest 4.
- Converted the workspace to Bun 1.3.14 with an isolated linker, `bun.lock`, Bun-first scripts, and trusted dependency controls.
- Removed Webpack opt-out paths; Next 16 builds now use the default Turbopack path in local and Docker builds, the app config declares `turbopack: {}`, and the custom Next server explicitly selects Turbopack.
- Hardened Docker packaging around Bun/Node 24 native dependency builds, runtime env injection, and `.env` exclusion from the build context.
- Baseline before the Bun migration: typecheck passed in 14.65s, non-real Vitest passed in 6.39s, and production build passed in 30.45s.
- Converted the API surface to App Router route handlers, with old webhook/deploy callback logic wrapped through compatibility helpers where risky.
- Flattened Kumo-based dashboard/settings/service shells and removed most card-in-card surfaces.
- Made `/dashboard/deployments` the canonical deployment history route; `/dashboard/builds` is only a compatibility alias.
- Extracted the dashboard navigation model and tests.
- Reworked the environment view into a workspace canvas with service layout, search, filters, sort, command palette, topology groups, service drawer tabs, connection modeling, generated connection variables, and bulk actions.
- Added canonical workspace route helpers, tests, and new App Router pages for canonical environment/service URLs.
- Converted old `/dashboard/project/...` pages into redirect-only compatibility routes that preserve service tabs and send users to canonical `/dashboard/workspace/...` URLs.
- Moved workspace service route client modules out of the legacy project route tree and into the canonical workspace service route.
- Rehomed the remaining workspace creation/environment action components from `components/dashboard/project/*` into `components/dashboard/workspace/actions/*`.
- Folded the old `/dashboard/projects` bulk management surface into `/dashboard/workspace?view=workspaces`, moved the list/create/variables components under `components/dashboard/workspace/manage/*`, and left `/dashboard/projects` as a redirect-only compatibility route.
- Rehomed the container runtime UI component subtree from `components/dashboard/docker/*` to `components/dashboard/container-runtime/*` while leaving literal Docker engine utilities under server code.
- Rehomed the cluster runtime UI component subtree from `components/dashboard/swarm/*` to `components/dashboard/cluster-runtime/*`, renamed visible component symbols, and replaced user-facing orchestration wording with cluster runtime language while preserving literal Docker Swarm API/docs/commands.
- Rehomed runtime worker settings from `components/dashboard/settings/servers/*` to `components/dashboard/settings/runtime/*` and tightened visible setup/validation/security copy around workers instead of servers.
- Rehomed the service advanced ingress config UI from `components/dashboard/application/advanced/traefik/*` to `components/dashboard/application/advanced/ingress/*` and renamed exported component symbols to ingress language while preserving backend Traefik config API fields.
- Improved development setup by making Postgres readiness check the configured `DATABASE_URL` and fail fast for role/database/password problems.
- Recorded the first upstream PR security audit under `outputs/docklands-pr-security-audit.md` outside the repo.

## Next High-Impact Work

- Audit visible copy for old mental models: "project list", "builds", "server", "Docker", "Traefik", "Swarm", and "Dokploy". Keep engine names only where they are literal engine concepts.
- Continue polishing the canvas as the primary app surface: first-run empty state, service card density, connection affordances, command palette actions, service drawer hierarchy, and mobile behavior.
- Reduce legacy route aliases once docs, navigation, search, notifications, and internal links no longer depend on them.
- Add browser-level visual QA once a safe local runtime is available; do not start the dev server unless explicitly allowed in the current turn.
- Decide whether a generated docs app and landing app should be scaffolded under `apps/docs` and `apps/site` after the control plane is stable.

## Verification Gates

For code changes, aim to run:

```sh
bun --filter docklands format-and-lint:fix
bun --filter docklands typecheck
bun --filter docklands test:ci
bun --filter docklands build
```

For docs-only changes, at minimum run:

```sh
git diff --check
```

## Recent Verified Checkpoints

- `28741e05d Add canonical workspace routes`
  - Historical pre-Bun checkpoint: typecheck, non-real Vitest, and production build passed.
- `32d87243 Track Docklands transformation work`
  - `git diff --check`
- `c2232220e Use database readiness check during setup`
  - Setup path now waits on the configured database connection before migrations.
- `2b1c78fcd Validate DATABASE_URL while waiting for Postgres`
  - Added unit coverage for Postgres wait diagnostics.
- Current Bun/Turbopack tooling checkpoint
  - `bun install --frozen-lockfile`
  - `bun pm untrusted`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
  - `docker build --target build -f apps/docklands/Dockerfile .`
  - `docker build --target docklands -f apps/docklands/Dockerfile .`
- Current legacy-route redirect checkpoint
  - `bun --filter docklands test --run __test__/navigation/legacy-route-redirects.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace-action source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace-list route checkpoint
  - `bun --filter docklands test --run __test__/navigation/dashboard-routes.test.ts __test__/navigation/dashboard-nav.test.ts __test__/navigation/legacy-route-redirects.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current container-runtime source-layout checkpoint
  - `bun --filter docklands test --run __test__/utils/log-type.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current Turbopack config checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands build-next`
- Current runtime-worker settings source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current cluster-runtime source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current service-ingress source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`

## Open Questions

- Which settings surfaces should remain top-level for self-hosted users versus move into a lower-level runtime/admin area?
- Which, if any, upstream PRs after the first audit deserve a second focused security review?
