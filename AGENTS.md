# AGENTS.md

@README.md

This is Docklands: a fork focused on self-hosted deployment management. Treat the repository as a Bun workspace with separate deployable surfaces. Today only `apps/docklands` exists; later `apps/site` and `apps/docs` can be added as independent Astro deployables.

## AGENTS.md Scope

- This root file owns repo-wide architecture, workspace commands, development modes, dependency notes, and branding.
- Nested `AGENTS.md` files are intentionally disjoint. They should add only subtree-specific boundaries and should not copy root-level rules.
- If guidance applies everywhere, keep it here. If guidance applies only to one subtree, keep it in the nearest nested `AGENTS.md`.

## Product Shape

- `apps/docklands/` is the installable Next.js control plane users run on their own VM.
- Future `apps/site/` should be the public landing/marketing site, likely Astro.
- Future `apps/docs/` should be the public documentation site, likely Astro/Starlight.
- The hosted surfaces explain and document Docklands. They must not assume Docklands itself is hosted for users.
- The Docklands app should keep assuming customer-owned infrastructure: Docker Engine, VM filesystem, ports, secrets, domains, and app data live on the user's machine or server.

## Project Shape

- `apps/docklands/app/` contains the Next.js App Router UI and API route handlers.
- `apps/docklands/components/` contains dashboard, shared, layout, and primitive UI components.
- `apps/docklands/client/` contains browser-only app glue: tRPC client, providers, auth client, client hooks, and OAuth UI helpers.
- `apps/docklands/shared/` contains cross-runtime validation and utility helpers. Keep it free of Node-only APIs unless the file is explicitly server-only.
- `apps/docklands/server/` contains the custom server entrypoint, tRPC API wiring, queues, WebSocket glue, ops scripts, and backend runtime helpers.
- `apps/docklands/server/core/` contains backend/domain code: database schema, Drizzle config, services, auth, Docker/Traefik/deployment/backup utilities, monitoring, templates, and verification.
- `apps/docklands/server/ops/` contains runtime/admin entrypoints bundled into `dist`: DB migration, setup, wait-for-postgres, reset-password, reset-2fa, and auth-secret migration.
- `apps/docklands/tools/` contains app-coupled development scripts such as OpenAPI generation.
- `tools/` contains repository-level tooling such as Docker image build/push scripts.
- `biome.json` is workspace-level so root and app commands share one formatter/linter configuration.
- `apps/docklands/drizzle/` contains generated SQL migrations and snapshots. Do not hand-edit snapshots unless you are deliberately repairing a generated migration.
- `apps/docklands/__test__/` contains Vitest coverage for backend behavior, security fixes, templates, deployments, WebSockets, permissions, and utilities.
- `apps/docklands/app/globals.css` is the Tailwind v4 entrypoint and explicitly loads `tailwind.config.ts` with `@config`.
- `.docker/` is generated local runtime state.

## Current Stack

Use Bun. The repo currently targets Node `>=24.4.0 <26` and Bun `>=1.3.14`.

Key Docklands app versions after the dependency refresh:

- Next.js 16
- React 19
- TypeScript 6
- Tailwind CSS 4 with `@tailwindcss/postcss`
- Biome 2
- tRPC 11
- Drizzle ORM plus Drizzle Zod
- Better Auth
- Vitest 4

## Runtime And Tooling Split

Bun and Node have distinct, non-overlapping roles. Keep them separated:

- **Bun is the package manager and task runner.** Use Bun for `bun install`, `bun.lock`, and every `bun run <script>` / `bun --filter docklands <script>` entrypoint.
- **Node 24 is the application runtime, in both development and production.** The dev server (`bun dev` runs `tsx server/server.ts` on Node), the build (`esbuild` targets `node24`, plus `next build`), and production (`node ... dist/*.mjs`, Docker base `node:24.4.0-slim`) all execute app code on Node, never on Bun's runtime. Bun is only ever the launcher.

This split is deliberate. Docklands depends on native addons (`node-pty`, `ssh2`, `dockerode`, `bcrypt`) and ships on Node, so development must exercise the same runtime it deploys on. Do not switch the app runtime to Bun: no `bun --bun` for app processes and no `bun server/server.ts`. `bun --bun` is acceptable only as a temporary local escape hatch for the toolchain (typecheck/build) when a usable Node is unavailable; it is not how the app is meant to run.

Pin Node with the repo `.nvmrc` (`24.4.0`). Use a version manager such as fnm (`eval "$(fnm env --use-on-cd --shell zsh)"`) so entering the repo selects Node 24 automatically. Avoid Homebrew's rolling `node`, which tracks the latest major and will drift past the supported `<26` range and break native module linkage.

## Development Model

Docklands is a deployment control plane, so full local development is closer to a disposable Linux VM/devbox than a normal Next-only app. It can initialize Docker Swarm, create Docker networks/services/containers/volumes, bind common ports, and mount the Docker socket.

- For UI or light backend work, use a normal Node environment plus a reachable Postgres, then run `bun install`, copy `apps/docklands/.env.example` to `apps/docklands/.env`, run `bun run migration:run`, and start `bun run dev`. Docker-heavy deployment flows will not be representative in this mode.
- For full local behavior, use a Docker Engine you are comfortable mutating. The setup path initializes Swarm, `docklands-network`, Traefik, Redis, Postgres, local runtime directories, and migrations. Use `NODE_ENV=development bun run setup` when you need Postgres and Redis published on local ports, then run `bun run dev`.
- The best practical full-dev target is a disposable Linux VM/devbox with Docker Engine, Node 24, and Bun. Avoid running full setup against a laptop Docker daemon that has important containers, networks, or port bindings.
- Development runtime files use `.docker/`; production/server-mode paths use `/etc/docklands` and Docker resources now use Docklands names such as `docklands-network`, `docklands-postgres`, `docklands-redis`, and `docklands-traefik`.
- Expect possible conflicts on ports `80`, `443`, `5432`, `6379`, `3000`, and any app ports created by deployment tests or manual experiments.

## Local Documentation

- The installed Next.js package includes bundled docs under the app package's installed dependency tree, usually `apps/docklands/node_modules/next/dist/docs`.
- This repo currently has Next `16.2.9`; check those local docs before relying on memory or web search for Next behavior.
- Search them with `rg`, for example:

```sh
rg -n "Route Handlers|App Router|Server Actions" apps/docklands/node_modules/next/dist/docs
```

## Hard Rules

- Do not reintroduce AI features or AI dependencies. The AI router, schema, service, provider utilities, settings page, project assistant, and log analyzer were intentionally removed.
- Do not reintroduce proprietary, commercial-license, or hosted-only code paths unless the user explicitly asks and the licensing implications are reviewed.
- Preserve the workspace split. `apps/docklands` is the self-hosted product; future public site/docs apps should be separate deployables.
- Do not add `packages/` until there is real shared code that is needed by at least two apps and cannot live cleanly in one app.
- Keep `apps/docklands/server/core/` as the backend/domain library unless there is a real architectural reason to move code.
- Treat security-sensitive changes as test-worthy. Local `AGENTS.md` files call out the riskiest boundaries for each subtree.
- Do not weaken type safety or disable strictness globally to get past upgrade friction.
- Avoid touching generated build output such as `.next/`, `dist/`, and `node_modules/`.

## Common Commands

Install dependencies:

```sh
bun install --frozen-lockfile
```

Format and lint:

```sh
bun run format-and-lint:fix
```

Typecheck:

```sh
bun run typecheck
```

Run the usual non-real test suite:

```sh
bun run test:ci
```

Build:

```sh
bun run build
```

Generate a migration after schema changes:

```sh
bun run migration:generate
```

Build a Docker image:

```sh
bun run docker:build
```

## Verification Notes

- `bun run build` may need permissions to create a local `tsx` IPC pipe.
- `bun --filter docklands build-next` uses Turbopack and may need permissions to spawn local Turbopack/CSS worker processes.
- Build output can be noisy if local Postgres/Docker secrets are not configured. The important part is whether the build exits successfully.
- The full real deployment tests may need Docker socket access, nixpacks/build tooling, and a more complete local runtime. Prefer the non-real Vitest command above for routine changes.
- `bun run format-and-lint:fix` currently passes but may report Biome warnings such as optional-chain suggestions, radix suggestions, and unused suppressions.

## Dependency And Migration Notes

- Next 16 uses Turbopack by default, and Docklands makes that explicit with `next build --turbopack` plus `turbopack: true` in the custom Next server. Do not add custom Webpack config, Webpack opt-out env vars, `--webpack`, or legacy `--turbo` flags. `bun --filter docklands build` and root `bun run test:ci` run `check:bundler`; run `bun run check:bundler` directly after bundler/tooling changes.
- Tailwind 4 uses `apps/docklands/postcss.config.cjs` with `@tailwindcss/postcss`; do not switch it back to `tailwindcss` as a PostCSS plugin.
- `apps/docklands/app/globals.css` uses `@import "tailwindcss";` and `@config "../tailwind.config.ts";`.
- React Email now uses `render`, not `renderAsync`.
- xterm uses `@xterm/addon-fit`, not the old `xterm-addon-fit`.
- Node provides `File`; only a minimal server-side `FileList` shim lives in `apps/docklands/shared/validation/schema.ts`.
- If you remove a database table or field, generate a Drizzle migration and commit both the SQL and matching `apps/docklands/drizzle/meta` snapshot/journal updates.

## Branding

The product name is Docklands. Active code, user-facing copy, package names, Docker resources, and runtime paths should use Docklands naming. README, NOTICE, and other historical/legal docs may still mention the upstream project where attribution requires it.

## Before Finishing

For code changes, aim to run:

```sh
bun run format-and-lint:fix
bun run typecheck
bun run test:ci
bun run build
```

For docs-only changes, at minimum run `git diff --check`.
