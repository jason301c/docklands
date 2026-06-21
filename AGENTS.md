# AGENTS.md

This is Docklands: a fork of Dokploy focused on self-hosted deployment management. Treat it as a single-root Next.js app with a colocated backend, not as a multi-package monorepo.

## Project Shape

- `pages/` contains the Next.js Pages Router UI and API routes.
- `components/` contains dashboard, shared, layout, and primitive UI components.
- `server/` contains the custom server entrypoint, tRPC API wiring, queues, and WebSocket glue.
- `server-core/` contains the shared backend/domain code: database schema, services, auth, Docker/Traefik/deployment/backup utilities, monitoring, templates, and verification.
- `server/db/` contains Drizzle config, reset, and seed scripts.
- `drizzle/` contains generated SQL migrations and snapshots. Do not hand-edit snapshots unless you are deliberately repairing a generated migration.
- `__test__/` contains Vitest coverage for backend behavior, security fixes, templates, deployments, WebSockets, permissions, and utilities.
- `styles/globals.css` is the Tailwind v4 entrypoint and explicitly loads `tailwind.config.ts` with `@config`.
- `docker/`, `.docker/`, and Docker socket access are part of normal local workflows.

## Current Stack

Use `pnpm`. The repo currently targets Node `^24.4.0` and pnpm `>=10.22.0`.

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

## Hard Rules

- Do not reintroduce AI features or AI dependencies. The AI router, schema, service, provider utilities, settings page, project assistant, and log analyzer were intentionally removed.
- Do not reintroduce proprietary or hosted-only code paths unless the user explicitly asks and the licensing implications are reviewed.
- Preserve the single-root app layout. Do not recreate `apps/` or package-scope splits unless the user explicitly asks for a larger architecture change.
- Keep `server-core/` as the backend/domain library unless there is a real architectural reason to move code.
- Be careful with security-sensitive areas: drop uploads, zip extraction, shell command building, Docker/Traefik config generation, authentication, secrets, SSH keys, Git webhooks, and deployment logs.
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
- Node provides `File`; only a minimal server-side `FileList` shim lives in `utils/schema.ts`.
- If you remove a database table or field, generate a Drizzle migration and commit both the SQL and matching `drizzle/meta` snapshot/journal updates.

## Branding

The product name is Docklands. If user-facing copy, docs, or package names still mention Dokploy, treat that as legacy fork residue unless it is part of an upstream package name or historical migration data.

## Before Finishing

For code changes, aim to run:

```sh
pnpm format-and-lint:fix
pnpm typecheck
pnpm exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts
pnpm build
```

For docs-only changes, at minimum run `git diff --check`.
