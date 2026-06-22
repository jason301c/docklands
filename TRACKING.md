# Docklands Transformation Tracker

This file tracks the ongoing move from the inherited Dokploy admin dashboard to a polished Railway-inspired, self-hosted Docklands project canvas. Keep it current when committing meaningful product, architecture, migration, or verification work.

## Current Baseline

- Branch: `canary`
- Latest pushed checkpoint: `28741e05d Add canonical workspace routes`
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
- Converted the API surface to App Router route handlers, with old webhook/deploy callback logic wrapped through compatibility helpers where risky.
- Flattened Kumo-based dashboard/settings/service shells and removed most card-in-card surfaces.
- Made `/dashboard/deployments` the canonical deployment history route; `/dashboard/builds` is only a compatibility alias.
- Extracted the dashboard navigation model and tests.
- Reworked the environment view into a workspace canvas with service layout, search, filters, sort, command palette, topology groups, service drawer tabs, connection modeling, generated connection variables, and bulk actions.
- Added canonical workspace route helpers, tests, and new App Router pages for canonical environment/service URLs.
- Improved development setup by making Postgres readiness check the configured `DATABASE_URL` and fail fast for role/database/password problems.
- Recorded the first upstream PR security audit under `outputs/docklands-pr-security-audit.md` outside the repo.

## Next High-Impact Work

- Convert old `/dashboard/project/...` pages into redirects to canonical `/dashboard/workspace/...` URLs.
- Rename or reorganize remaining source folders whose names now fight the product model, especially `components/dashboard/project/*`, once route compatibility is stable.
- Audit visible copy for old mental models: "project list", "builds", "server", "Docker", "Traefik", "Swarm", and "Dokploy". Keep engine names only where they are literal engine concepts.
- Continue polishing the canvas as the primary app surface: first-run empty state, service card density, connection affordances, command palette actions, service drawer hierarchy, and mobile behavior.
- Reduce legacy route aliases once docs, navigation, search, notifications, and internal links no longer depend on them.
- Add browser-level visual QA once a safe local runtime is available; do not start the dev server unless explicitly allowed in the current turn.
- Decide whether a generated docs app and landing app should be scaffolded under `apps/docs` and `apps/site` after the control plane is stable.

## Verification Gates

For code changes, aim to run:

```sh
pnpm --filter docklands exec biome check --write <touched app-relative paths>
pnpm --filter docklands typecheck
pnpm --filter docklands exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts
pnpm --filter docklands build
```

For docs-only changes, at minimum run:

```sh
git diff --check
```

## Recent Verified Checkpoints

- `28741e05d Add canonical workspace routes`
  - `pnpm --filter docklands typecheck`
  - `pnpm --filter docklands exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts`
  - `pnpm --filter docklands build`
- `c2232220e Use database readiness check during setup`
  - Setup path now waits on the configured database connection before migrations.
- `2b1c78fcd Validate DATABASE_URL while waiting for Postgres`
  - Added unit coverage for Postgres wait diagnostics.

## Open Questions

- How long should old compatibility routes stay available after canonical workspace routes are stable?
- Should the old project/service source folder names be renamed mechanically now, or only after route redirects and visual QA?
- Which settings surfaces should remain top-level for self-hosted users versus move into a lower-level runtime/admin area?
- Which, if any, upstream PRs after the first audit deserve a second focused security review?
