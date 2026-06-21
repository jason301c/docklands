# AGENTS.md

This is Docklands: a fork focused on self-hosted deployment management. Treat it as a single-root Next.js app with a colocated backend, not as a multi-package monorepo.

## AGENTS.md Scope

- This root file owns repo-wide architecture, stack, development modes, common commands, dependency notes, and branding.
- Nested `AGENTS.md` files are intentionally disjoint. They should add only subtree-specific boundaries and should not copy root-level rules.
- If guidance applies everywhere, keep it here. If guidance applies only to one subtree, keep it in the nearest nested `AGENTS.md`.

## Project Shape

- `app/` contains the Next.js App Router UI and API route handlers.
- `components/` contains dashboard, shared, layout, and primitive UI components.
- `client/` contains browser-only app glue: tRPC client, providers, auth client, client hooks, and OAuth UI helpers.
- `shared/` contains cross-runtime validation and utility helpers. Keep it free of Node-only APIs unless the file is explicitly server-only.
- `server/` contains the custom server entrypoint, tRPC API wiring, queues, WebSocket glue, ops scripts, and backend runtime helpers.
- `server/core/` contains the shared backend/domain code: database schema, Drizzle config, services, auth, Docker/Traefik/deployment/backup utilities, monitoring, templates, and verification.
- `server/ops/` contains runtime/admin entrypoints bundled into `dist`: DB migration, setup, wait-for-postgres, reset-password, reset-2fa, and auth-secret migration.
- `tools/` contains development-only scripts such as OpenAPI generation.
- `drizzle/` contains generated SQL migrations and snapshots. Do not hand-edit snapshots unless you are deliberately repairing a generated migration.
- `__test__/` contains Vitest coverage for backend behavior, security fixes, templates, deployments, WebSockets, permissions, and utilities.
- `styles/globals.css` is the Tailwind v4 entrypoint and explicitly loads `tailwind.config.ts` with `@config`.
- `docker/` contains image build/push helpers. `.docker/` is generated local runtime state.

## Current Stack

Use `pnpm`. The repo currently targets Node `>=24.4.0 <26` and pnpm `>=10.22.0`.

Key versions after the dependency refresh:

- Next.js 16
- React 19
- TypeScript 6
- Tailwind CSS 4 with `@tailwindcss/postcss`
- Biome 2
- tRPC 11
- Drizzle ORM plus Drizzle Zod
- Better Auth
- Vitest 4

## Development Model

Docklands is a deployment control plane, so full local development is closer to a disposable Linux VM/devbox than a normal Next-only app. It can initialize Docker Swarm, create Docker networks/services/containers/volumes, bind common ports, and mount the Docker socket.

- For UI or light backend work, use a normal Node environment plus a reachable Postgres, then run `pnpm install`, copy `.env.example` to `.env`, run `pnpm migration:run`, and start `pnpm dev`. Docker-heavy deployment flows will not be representative in this mode.
- For full local behavior, use a Docker Engine you are comfortable mutating. The setup path initializes Swarm, `docklands-network`, Traefik, Redis, Postgres, local runtime directories, and migrations. Use `NODE_ENV=development pnpm setup` when you need Postgres and Redis published on local ports, then run `pnpm dev`.
- The best practical full-dev target is a disposable Linux VM/devbox with Docker Engine, Node 24, and pnpm. Avoid running full setup against a laptop Docker daemon that has important containers, networks, or port bindings.
- Development runtime files use `.docker/`; production/server-mode paths use `/etc/docklands` and Docker resources now use Docklands names such as `docklands-network`, `docklands-postgres`, `docklands-redis`, and `docklands-traefik`.
- Expect possible conflicts on ports `80`, `443`, `5432`, `6379`, `3000`, and any app ports created by deployment tests or manual experiments.

## Local Documentation

- The installed Next.js package includes bundled docs at `node_modules/next/dist/docs`.
- This repo currently has Next `16.2.9`; check those local docs before relying on memory or web search for Next behavior.
- Search them with `rg`, for example:

```sh
rg -n "Route Handlers|App Router|Server Actions" node_modules/next/dist/docs
```

## Hard Rules

- Do not reintroduce AI features or AI dependencies. The AI router, schema, service, provider utilities, settings page, project assistant, and log analyzer were intentionally removed.
- Do not reintroduce proprietary, commercial-license, or hosted-only code paths unless the user explicitly asks and the licensing implications are reviewed.
- Preserve the single-root app layout. Do not recreate `apps/` or package-scope splits unless the user explicitly asks for a larger architecture change.
- Keep `server/core/` as the backend/domain library unless there is a real architectural reason to move code.
- Treat security-sensitive changes as test-worthy. Local `AGENTS.md` files call out the riskiest boundaries for each subtree.
- Do not weaken type safety or disable strictness globally to get past upgrade friction.
- Avoid touching generated build output such as `.next/`, `dist/`, and `node_modules/`.

## Common Commands

Install dependencies:

```sh
pnpm install
```

Format and lint:

```sh
pnpm format-and-lint:fix
```

Typecheck:

```sh
pnpm typecheck
```

Run the usual non-real test suite:

```sh
pnpm exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts
```

Build:

```sh
pnpm build
```

Generate a migration after schema changes:

```sh
pnpm migration:generate
```

## Verification Notes

- `pnpm build` may need permissions to create a local `tsx` IPC pipe.
- Build output can be noisy if local Postgres/Docker secrets are not configured. The important part is whether the build exits successfully.
- The full real deployment tests may need Docker socket access, nixpacks/build tooling, and a more complete local runtime. Prefer the non-real Vitest command above for routine changes.
- `pnpm format-and-lint:fix` currently passes but reports Biome warnings such as optional-chain suggestions, radix suggestions, and unused suppressions.

## Dependency And Migration Notes

- Tailwind 4 uses `postcss.config.cjs` with `@tailwindcss/postcss`; do not switch it back to `tailwindcss` as a PostCSS plugin.
- `styles/globals.css` uses `@import "tailwindcss";` and `@config "../tailwind.config.ts";`.
- React Email now uses `render`, not `renderAsync`.
- xterm uses `@xterm/addon-fit`, not the old `xterm-addon-fit`.
- Node provides `File`; only a minimal server-side `FileList` shim lives in `shared/validation/schema.ts`.
- If you remove a database table or field, generate a Drizzle migration and commit both the SQL and matching `drizzle/meta` snapshot/journal updates.

## Branding

The product name is Docklands. Active code, user-facing copy, package names, Docker resources, and runtime paths should use Docklands naming. README, NOTICE, and other historical/legal docs may still mention the upstream project where attribution requires it.

## Before Finishing

For code changes, aim to run:

```sh
pnpm format-and-lint:fix
pnpm typecheck
pnpm exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts
pnpm build
```

For docs-only changes, at minimum run `git diff --check`.
