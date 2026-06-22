# AGENTS.md

`apps/docklands/` is the installable Docklands control plane that users run on their own VM.

- Keep this package self-contained: Next.js app, colocated backend, runtime services, migrations, tests, public assets, and app-specific tooling live here.
- Do not add hosted-SaaS assumptions. The app must work as customer-owned infrastructure with local Docker, filesystem state, ports, secrets, domains, and databases.
- Treat the project environment workspace canvas as the primary service surface. Extend `components/dashboard/workspace`, `shared/workspace-graph.ts`, `server/api/routers/workspace.ts`, and `server/core/services/workspace.ts` before adding parallel project-management pages.
- Workspace graph tables store layout/connection metadata only. Service lifecycle, deployment, variables, previews, logs, and provider behavior should continue to use the existing domain services and routers unless there is a deliberate migration.
- Treat `/dashboard/workspace` as the primary overview. Do not add legacy dashboard aliases or redirect-only compatibility routes.
- Product routes are canonical in navigation and new links: `/dashboard/deployments`, `/dashboard/container-runtime`, `/dashboard/cluster-runtime`, `/dashboard/proxy-files`, `/dashboard/host-metrics`, `/dashboard/settings/build-workers`, `/dashboard/settings/image-registry`, `/dashboard/settings/cluster-nodes`, `/dashboard/settings/ingress`, `/dashboard/settings/runtime`, and `/dashboard/settings/storage`.
- User-facing product language should usually say workspace, service, runtime, worker, ingress, container image, preview environment, and automatic placement.
- Reserve Docker, Traefik, Swarm, server, and the old route names for exact engine identifiers, commands, logs, schema/API names, imports, or explanatory docs. Do not use them as top-level product nouns when a Docklands term is available.
- UI source for settings should stay under product-named modules such as `settings/ingress-runtime`, `settings/runtime/terminal`, `settings/storage`, `settings/image-registry`, `settings/cluster-nodes`, and `container-runtime/*`; backend compatibility APIs like `getWebServerSettings`, `destination`, and `registry` can remain until dedicated data migrations rename them.
- Use tRPC for the app frontend/backend contract. Keep OpenAPI as the machine-readable API layer, but do not reintroduce Swagger UI.
- Use imported styled Kumo components from `@cloudflare/kumo` or granular `@cloudflare/kumo/components/*` paths for UI work. Prefer the installed package docs/types in `node_modules/@cloudflare/kumo` for API details, and prefer Kumo defaults for tokens/styles.
- Do not add ShadCN, Radix UI, cmdk, sonner, or `components/ui/` primitives. Reach for Kumo primitives only when no styled Kumo component can preserve the existing capability.
- Keep the custom Next server and production build on Turbopack. `server/server.ts` passes `turbopack: true`, `build-next` runs `next build --turbopack`, and app code should not add Webpack flags, Webpack opt-out env vars, or custom Webpack config. The app `build` script runs `check:bundler` before compiling; run it directly after bundler/tooling changes too.
- Keep `next.config.mjs` free of legacy dashboard redirects.
- `typecheck` already runs `next typegen` after cleaning stale `.next/dev/types`; use it instead of manually depending on previous dev/build route validators.
- Runtime/admin entrypoints belong in `server/ops/`; app-coupled development scripts belong in `tools/`; repository-level release scripts belong in `../../tools/`.
- The Dockerfile builds this app from the workspace root context so Bun can install the workspace consistently.
- You can run commands either through root scripts, such as `bun run typecheck`, or from this directory with the app-local scripts.
- Do not start the dev server unless the user explicitly asks. Use typecheck, Vitest, build, and static inspection for unattended verification.
