# AGENTS.md

`apps/docklands/` is the installable Docklands control plane that users run on their own VM.

- Keep this package self-contained: Next.js app, colocated backend, runtime services, migrations, tests, public assets, and app-specific tooling live here.
- Do not add hosted-SaaS assumptions. The app must work as customer-owned infrastructure with local Docker, filesystem state, ports, secrets, domains, and databases.
- Treat the project environment workspace canvas as the primary service surface. Extend `components/dashboard/workspace`, `shared/workspace-graph.ts`, `server/api/routers/workspace.ts`, and `server/core/services/workspace.ts` before adding parallel project-management pages.
- Workspace graph tables store layout/connection metadata only. Service lifecycle, deployment, variables, previews, logs, and provider behavior should continue to use the existing domain services and routers unless there is a deliberate migration.
- Treat `/dashboard/workspace` as the primary overview. `/dashboard/home` is compatibility-only and should redirect there.
- Product route aliases should be preferred in navigation and new links: `/dashboard/container-runtime` over `/dashboard/docker` or `/dashboard/runtime`, `/dashboard/cluster-runtime` over `/dashboard/swarm` or `/dashboard/orchestration`, `/dashboard/proxy-files` over `/dashboard/traefik` or `/dashboard/ingress`, `/dashboard/host-metrics` over `/dashboard/monitoring`, `/dashboard/settings/build-workers` over `/dashboard/settings/deployments`, `/dashboard/settings/image-registry` over `/dashboard/settings/registry`, `/dashboard/settings/cluster-nodes` over `/dashboard/settings/cluster`, `/dashboard/settings/ingress` over `/dashboard/settings/server`, `/dashboard/settings/runtime` over `/dashboard/settings/servers`, and `/dashboard/settings/storage` over `/dashboard/settings/destinations`.
- User-facing product language should usually say workspace, service, runtime, worker, ingress, container image, preview environment, and automatic placement.
- Reserve Docker, Traefik, Swarm, server, and the old route names for exact engine identifiers, commands, logs, schema/API names, imports, or explanatory docs. Do not use them as top-level product nouns when a Docklands term is available.
- Use tRPC for the app frontend/backend contract. Keep OpenAPI as the machine-readable API layer, but do not reintroduce Swagger UI.
- Use imported styled Kumo components from `@cloudflare/kumo` or granular `@cloudflare/kumo/components/*` paths for UI work. Prefer the installed package docs/types in `node_modules/@cloudflare/kumo` for API details, and prefer Kumo defaults for tokens/styles.
- Do not add ShadCN, Radix UI, cmdk, sonner, or `components/ui/` primitives. Reach for Kumo primitives only when no styled Kumo component can preserve the existing capability.
- Runtime/admin entrypoints belong in `server/ops/`; app-coupled development scripts belong in `tools/`; repository-level release scripts belong in `../../tools/`.
- The Dockerfile builds this app from the workspace root context so pnpm can install the workspace consistently.
- You can run commands either through root scripts, such as `pnpm typecheck`, or from this directory with the app-local scripts.
- Do not start the dev server unless the user explicitly asks. Use typecheck, Vitest, build, and static inspection for unattended verification.
