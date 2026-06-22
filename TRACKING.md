# Docklands Transformation Tracker

This file tracks the ongoing move from the inherited Dokploy admin dashboard to a polished Railway-inspired, self-hosted Docklands project canvas. Keep it current when committing meaningful product, architecture, migration, or verification work.

## Current Baseline

- Branch: `canary`
- Latest checkpoint: UI source naming cleanup
- Product direction: self-hosted VM control plane, not hosted Docklands-as-a-service.
- Primary app: `apps/docklands`, a Next.js 16 App Router app with a colocated backend under `server/`.
- Canonical workspace entry: `/dashboard/workspace`
- Canonical environment route: `/dashboard/workspace/[workspaceId]/[environmentId]`
- Canonical service route: `/dashboard/workspace/[workspaceId]/[environmentId]/service/[serviceType]/[serviceId]`
- Old `/dashboard/project/...` links and legacy single-page dashboard aliases are no longer supported.

## Done

- Forked upstream, renamed product and runtime resources toward Docklands.
- Removed proprietary/source-available upstream app surfaces and AI dependencies/plumbing.
- Removed Swagger UI while keeping OpenAPI generation and runtime API support.
- Moved to a single `apps/docklands` app layout with no `packages/` split.
- Added nested `AGENTS.md` files and clarified app/server/tools boundaries.
- Updated dependencies to the current major stack, including Next 16, React 19, TypeScript 6, Tailwind 4, Biome 2, tRPC 11, and Vitest 4.
- Converted the workspace to Bun 1.3.14 with an isolated linker, `bun.lock`, Bun-first scripts, and trusted dependency controls.
- Removed Webpack opt-out paths; Next 16 builds now explicitly use `next build --turbopack`, the app config declares `turbopack: {}`, and the custom Next server explicitly selects Turbopack.
- Made `typecheck` regenerate current Next route types with `next typegen` after cleaning stale dev validators, keeping TypeScript checks aligned with route deletions without a full build.
- Hardened Docker packaging around Bun/Node 24 native dependency builds, runtime env injection, and `.env` exclusion from the build context.
- Baseline before the Bun migration: typecheck passed in 14.65s, non-real Vitest passed in 6.39s, and production build passed in 30.45s.
- Converted the API surface to App Router route handlers; webhook/deploy/provider flows now live behind Fetch `Request` handlers under `server/web/`.
- Flattened Kumo-based dashboard/settings/service shells and removed most card-in-card surfaces.
- Made `/dashboard/deployments` the deployment history route and removed the old `/dashboard/builds` compatibility alias.
- Extracted the dashboard navigation model and tests.
- Reworked the environment view into a workspace canvas with service layout, search, filters, sort, command palette, topology groups, service drawer tabs, connection modeling, generated connection variables, and bulk actions.
- Added canonical workspace route helpers, tests, and new App Router pages for canonical environment/service URLs.
- Removed old `/dashboard/project/...` compatibility pages so canonical `/dashboard/workspace/...` routes are the only supported workspace detail surface.
- Moved workspace service route client modules out of the legacy project route tree and into the canonical workspace service route.
- Rehomed the remaining workspace creation/environment action components from `components/dashboard/project/*` into `components/dashboard/workspace/actions/*`.
- Folded the old `/dashboard/projects` bulk management surface into `/dashboard/workspace?view=workspaces`, moved the list/create/variables components under `components/dashboard/workspace/manage/*`, and removed the old route alias.
- Rehomed the container runtime UI component subtree from `components/dashboard/docker/*` to `components/dashboard/container-runtime/*` while leaving literal Docker engine utilities under server code.
- Rehomed the cluster runtime UI component subtree from `components/dashboard/swarm/*` to `components/dashboard/cluster-runtime/*`, renamed visible component symbols, and replaced user-facing orchestration wording with cluster runtime language while preserving literal Docker Swarm API/docs/commands.
- Rehomed runtime worker settings from `components/dashboard/settings/servers/*` to `components/dashboard/settings/runtime/*` and tightened visible setup/validation/security copy around workers instead of servers.
- Rehomed the service advanced ingress config UI from `components/dashboard/application/advanced/traefik/*` to `components/dashboard/application/advanced/ingress/*` and renamed exported component symbols to ingress language while preserving backend Traefik config API fields.
- Renamed the proxy-files UI modules from `show-traefik-*` to `show-ingress-*` so the file-management surface matches the Ingress Files product language while preserving literal Traefik runtime paths and APIs.
- Removed temporary legacy dashboard redirects from `next.config.mjs`; old admin URLs now fall through instead of being preserved as compatibility aliases.
- Rehomed the old settings `web-server` UI modules into product-named ingress runtime, runtime terminal, and container runtime modal modules while preserving backend API/schema compatibility names.
- Rehomed old settings `destination`, `cluster/registry`, and `cluster/nodes` UI modules into `settings/storage`, `settings/image-registry`, and `settings/cluster-nodes`, keeping backend permission/API compatibility names intact.
- Added a bundler guard so Docklands fails fast if workspace scripts, manifests, lockfile entries, Next config, or the custom server opt back into Webpack instead of Turbopack.
- Wired the bundler guard into build/test entrypoints and expanded it to catch Webpack-related environment opt-outs before a build can continue.
- Tightened the sidebar and command palette vocabulary around Docklands product nouns: Ingress, Build Workers, Image Registry, Cluster Nodes, Runtime Workers, Container Runtime, Cluster Runtime, Ingress Requests, and Host Metrics.
- Replaced visible canvas "run build" action copy with Deploy/Deployment language while keeping old keywords searchable.
- Replaced remaining visible project wording in workspace move/create-environment dialogs with workspace language while leaving `projectId` compatibility internals intact.
- Added `{{workspace.KEY}}` as the canonical workspace-variable reference syntax while preserving existing `{{project.KEY}}` service environment compatibility.
- Replaced duplicated service-detail runtime placement chips with a shared runtime-worker status surface and explicit automatic-placement/inactive-worker copy.
- Replaced visible domain DNS "server IP" guidance with ingress-address copy while leaving backend validation contracts intact.
- Renamed the shared runtime page filter from server-filter to runtime-worker-filter, tightened worker copy across runtime navigation/settings, and left the `serverId` URL/API contract intact until a backend migration is worth the churn.
- Removed stale old `/dashboard/project/...` route assertions from navigation tests now that compatibility aliases are gone.
- Removed active Bitbucket App Password support from API inputs, edit/test UI, provider auth helpers, and deprecated provider badges; the nullable DB column remains until a dedicated schema migration removes it.
- Removed hardcoded database and Better Auth fallback credentials from runtime paths; tests keep deterministic test-only values, and build commands supply explicit throwaway build envs for Next page-data collection.
- Replaced deployment-history visible project language with workspace language and added source coverage for the table/search copy.
- Replaced the template-create confirmation and workspace action refresh comments with workspace language while preserving backing `projectId` contracts.
- Replaced remaining visible project wording in service description placeholders, tag settings, organization creation, permissions scoping, SSH-key examples, runtime-worker role copy, and cluster empty states with workspace/service/workload language.
- Removed active `{{project.KEY}}` env-reference compatibility, added a migration that rewrites stored env strings to `{{workspace.KEY}}`, and dropped the old Bitbucket `appPassword` credential column.
- Removed unused React Email sample templates/assets, the unused Compose JSON schema, stale DBML generator/output, and the old PNPM devcontainer setup; also removed the now-unused `drizzle-dbml-generator` dependency.
- Replaced visible server/project/Docker-cleanup wording across onboarding, runtime-worker settings, service API errors, setup logs, threshold notifications, backup/build notifications, and cleanup notifications with runtime-worker/workspace/container-runtime language.
- Renamed canonical workspace App Router params and route-helper contracts from `projectId` to `workspaceId` while preserving DB/API `projectId` compatibility internals.
- Added product-named tRPC roots for `workspaces` and `runtimeWorker`, migrated frontend callers off `api.project`/`api.server`, and added a source guard to keep UI code on the product roots while backend compatibility roots remain.
- Switched runtime filter and WebSocket clients to emit `runtimeWorkerId` query params while WSS handlers continue accepting legacy `serverId` links.
- Rehomed the paid metrics UI from `metrics/paid/servers` to `metrics/paid/runtime-workers` and renamed the build-worker settings component source from `show-build-server` to `show-build-worker`.
- Centralized the workspace service creation placement selector so application, compose, database, import, and template flows all use the same automatic-placement/runtime-worker UI and copy.
- Replaced the workspace overview's zero-workspace placeholder with a canvas-first launch state and loading-aware recent panels.
- Improved development setup by making Postgres readiness check the configured `DATABASE_URL` and fail fast for role/database/password problems.
- Recorded the first upstream PR security audit under `outputs/docklands-pr-security-audit.md` outside the repo.

## Next High-Impact Work

- Audit visible copy for old mental models: "project list", "builds", "server", "Docker", "Traefik", "Swarm", and "Dokploy". Keep engine names only where they are literal engine concepts.
- Continue polishing the canvas as the primary app surface: first-run empty state, service card density, connection affordances, command palette actions, service drawer hierarchy, and mobile behavior.
- Continue auditing compatibility names in backend data/API layers and remove them when a migration is worth the churn.
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
- Current workspace-action source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace-list route checkpoint
  - `bun --filter docklands test --run __test__/navigation/dashboard-routes.test.ts __test__/navigation/dashboard-nav.test.ts`
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
- Current ingress-files source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current app-route alias cleanup checkpoint
  - `bun --filter docklands test --run __test__/navigation/dashboard-routes.test.ts __test__/navigation/dashboard-nav.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current ingress-runtime settings source-layout checkpoint
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current product settings source-layout and Turbopack guard checkpoint
  - `bun run check:bundler`
  - `bun --filter docklands check:bundler`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current product navigation vocabulary checkpoint
  - `bun --filter docklands test --run __test__/navigation/dashboard-nav.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current shared workspace placement selector checkpoint
  - `bun --filter docklands test --run __test__/workspace/placement-copy.test.ts __test__/workspace/workspace-graph.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current hardened Turbopack bundler guard checkpoint
  - `bun run check:bundler`
  - `bun run format-and-lint:fix`
  - `bun run build-next`
- Current workspace first-run canvas checkpoint
  - `bun --filter docklands test --run __test__/workspace/workspace-overview.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current canvas deployment action language checkpoint
  - `bun --filter docklands test --run __test__/workspace/environment-canvas-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace dialog product copy checkpoint
  - `bun --filter docklands test --run __test__/workspace/workspace-visible-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace variable namespace alias checkpoint
  - `bun --filter docklands test --run __test__/env/shared.test.ts __test__/workspace/workspace-visible-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current runtime-worker filter copy checkpoint
  - `bun --filter docklands test --run __test__/runtime/runtime-worker-filter-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current legacy-route and Bitbucket API-token checkpoint
  - `bun --filter docklands test --run __test__/navigation/dashboard-routes.test.ts __test__/navigation/dashboard-nav.test.ts __test__/permissions/check-permission.test.ts __test__/permissions/resolve-permissions.test.ts __test__/git-provider/bitbucket-auth.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current credential fallback removal checkpoint
  - `bun --filter docklands test --run __test__/db-constants.test.ts __test__/auth-secret.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current deployment history workspace-language checkpoint
  - `bun --filter docklands test --run __test__/deploy/deployments-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace action copy checkpoint
  - `bun --filter docklands test --run __test__/workspace/workspace-visible-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current visible settings/service copy checkpoint
  - `bun --filter docklands test --run __test__/workspace/workspace-visible-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current workspace env namespace migration checkpoint
  - `bun --filter docklands test --run __test__/env/shared.test.ts __test__/env/environment.test.ts __test__/env/stack-environment.test.ts __test__/git-provider/bitbucket-auth.test.ts __test__/migrations/workspace-env-migration.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current unused tooling/sample cleanup checkpoint
  - `rg -n "NotionMagicLinkEmail|PlaidVerifyIdentityEmail|VercelInviteUserEmail|notion-magic-link|plaid-verify-identity|vercel-invite-user|compose-spec|schema.dbml|dbml.ts|drizzle-dbml-generator|devcontainer|pnpm" . --glob '!node_modules' --glob '!apps/docklands/.next' --glob '!apps/docklands/dist' --glob '!TRACKING.md'`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`
- Current runtime/workspace API and notification copy checkpoint
  - `bun --filter docklands test --run __test__/copy/product-copy.test.ts`
  - `bun --filter docklands format-and-lint:fix`
  - `bun --filter docklands typecheck`
  - `bun --filter docklands test:ci`
  - `bun --filter docklands build`

## Open Questions

- Which settings surfaces should remain top-level for self-hosted users versus move into a lower-level runtime/admin area?
- Which, if any, upstream PRs after the first audit deserve a second focused security review?
