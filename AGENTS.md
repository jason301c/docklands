# AGENTS.md

@README.md

Docklands is a community fork of the upstream self-hosted deployment platform
([dokploy/dokploy](https://github.com/dokploy/dokploy)), focused on a cleaner,
project-first deployment control plane that users run on their own VM. Treat the
repository as a Bun workspace with separate deployable surfaces. Today only
`apps/docklands` exists; later `apps/site` and `apps/docs` can be added as
independent Astro deployables.

This root file owns repo-wide concerns: the workspace layout, the runtime split,
the toolchain, development modes, repo-wide rules, dependency notes, and
branding. Everything specific to the control-plane app — its architecture,
directory layout, product conventions, backend domain, and security boundaries —
lives in `apps/docklands/AGENTS.md`. Read both when working inside the app.

## AGENTS.md Policy

Docklands keeps exactly **two** `AGENTS.md` files:

- `AGENTS.md` (this file) — repo-wide architecture, workspace, toolchain, and rules.
- `apps/docklands/AGENTS.md` — everything about the control-plane app.

Do not reintroduce per-subtree `AGENTS.md` files (there used to be ~16 of them;
they were intentionally consolidated). If guidance is genuinely repo-wide, put it
here. If it is about the app or any subtree inside it, put it in
`apps/docklands/AGENTS.md`. A `CLAUDE.md` symlink points at each `AGENTS.md` so
both files are discovered by every agent tool; keep the symlinks alongside their
targets.

**Keep these files current.** They are the contract every agent reads first, so
update them in the same change that makes them stale. Refresh the relevant
`AGENTS.md` whenever you:

- add, remove, rename, or repurpose a top-level directory or workspace package;
- change the toolchain, runtime versions, build/test/migration commands, or the
  Bun/Node split;
- introduce or retire an architectural pattern (a new router layer, queue,
  auth/permission model, UI library, data store, etc.);
- change a product-naming or routing convention, or a hard rule below;
- discover that something documented here is now wrong.

Prefer correcting these files over leaving a stale note. Match the existing
voice: durable rules and rationale, not changelog entries. Do not paste
transient task state, dated TODOs, or PR-specific detail. When you finish a
change that touches structure or conventions, re-read the affected `AGENTS.md`
and reconcile it before wrapping up.

## Product Shape

- `apps/docklands/` is the installable Next.js control plane users run on their own VM.
- Future `apps/site/` should be the public landing/marketing site, likely Astro.
- Future `apps/docs/` should be the public documentation site, likely Astro/Starlight.
- The hosted surfaces explain and document Docklands. They must not assume Docklands itself is hosted for users.
- The Docklands app assumes customer-owned infrastructure: Docker Engine, the VM
  filesystem, ports, secrets, domains, and app data all live on the user's
  machine or server. Never add hosted-SaaS assumptions to the self-hosted path.

## Repository Layout

- `apps/` — independently deployable, user-facing surfaces. Keep each app
  deployable on its own; one app must never import another app's source.
  - `apps/docklands/` — the only app today: the self-hosted control plane.
- `tools/` — repository-level development and release scripts (e.g.
  `tools/docker/` image build/push helpers, `tools/check-bundler.mjs`). Tools may
  coordinate app packages or release artifacts but must not be required at
  production runtime. App-coupled scripts that import app internals belong in
  `apps/docklands/tools/`; production startup/migration/recovery entrypoints
  belong in `apps/docklands/server/ops/`.
- `biome.json` — workspace-level so root and app share one formatter/linter config.
- `bun.lock`, `bunfig.toml`, `package.json` — the Bun workspace root.
- `docs/` — repo-level documentation/output.
- `.docker/` — generated local runtime state (development).
- `dist/`, `.next/`, `node_modules/` — generated; do not hand-edit.

`tools/docker/` scripts resolve the repo root from their own path so they work
from any cwd, build with the workspace root as context against
`apps/docklands/Dockerfile`, and read the image version from
`apps/docklands/package.json`. Keep production runtime logic out of `tools/`.

## Current Stack

Use Bun as the package manager and task runner. The repo targets Node
`>=24.4.0 <26` and Bun `>=1.3.14`.

Key versions in `apps/docklands` after the dependency refresh:

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript 6
- Tailwind CSS 4 with `@tailwindcss/postcss`
- Biome 2
- tRPC 11
- Drizzle ORM + Drizzle Zod, on PostgreSQL (`postgres.js`)
- Better Auth (organization, admin, two-factor, API-key plugins)
- Cloudflare Kumo (`@cloudflare/kumo`) as the UI component library
- Vitest 4
- Zod 4

## Runtime And Tooling Split

Bun and Node have distinct, non-overlapping roles. Keep them separated:

- **Bun is the package manager and task runner.** Use Bun for `bun install`,
  `bun.lock`, and every `bun run <script>` / `bun --filter docklands <script>`
  entrypoint.
- **Node 24 is the application runtime, in both development and production.** The
  dev server (`bun dev` runs `tsx server/server.ts` on Node), the build (esbuild
  targets `node24`, plus `next build`), and production (`node ... dist/*.mjs`,
  Docker base `node:24.4.0-slim`) all execute app code on Node, never on Bun's
  runtime. Bun is only ever the launcher.

This split is deliberate. Docklands depends on native addons (`node-pty`,
`ssh2`, `dockerode`, `bcrypt`) and ships on Node, so development must exercise the
same runtime it deploys on. Do not switch the app runtime to Bun: no `bun --bun`
for app processes and no `bun server/server.ts`. `bun --bun` is acceptable only
as a temporary local escape hatch for the toolchain (typecheck/build) when a
usable Node is unavailable; it is not how the app is meant to run.

Pin Node with the repo `.nvmrc` (`24.4.0`). Use a version manager such as fnm
(`eval "$(fnm env --use-on-cd --shell zsh)"`) so entering the repo selects Node
24 automatically. Avoid Homebrew's rolling `node`, which tracks the latest major
and will drift past the supported `<26` range and break native module linkage.

## Development Model

Docklands is a deployment control plane, so full local development is closer to a
disposable Linux VM/devbox than a normal Next-only app. It can initialize Docker
Swarm, create Docker networks/services/containers/volumes, bind common ports, and
mount the Docker socket.

- **Light mode (UI / light backend):** a normal Node environment plus a reachable
  Postgres. Run `bun install`, copy `apps/docklands/.env.example` to
  `apps/docklands/.env`, run `bun run migration:run`, and start `bun run dev`.
  Docker-heavy deployment flows will not be representative in this mode.
- **Full mode:** a Docker Engine you are comfortable mutating. The setup path
  initializes Swarm, `docklands-network`, Traefik, Postgres, local runtime
  directories, and migrations. Use `NODE_ENV=development bun run setup` to publish
  Postgres on a local port, then `bun run dev`.
- The best practical full-dev target is a disposable Linux VM/devbox with Docker
  Engine, Node 24, and Bun. Avoid running full setup against a laptop Docker
  daemon that holds important containers, networks, or port bindings.
- Development runtime files use `.docker/`; production/server-mode paths use
  `/etc/docklands`. Docker resources use Docklands names such as
  `docklands-network`, `docklands-postgres`, and `docklands-traefik`.
- Expect possible conflicts on ports `80`, `443`, `5432`, `3000`, and any app
  ports created by deployment tests or manual experiments.
- Do not start the dev server for unattended verification unless the user asks.
  Use typecheck, Vitest, build, and static inspection instead.

## Workspace Commands

Root scripts proxy into the app via `bun --filter docklands`. You can run them
from the repo root or use the app-local scripts from `apps/docklands/`.

```sh
bun install --frozen-lockfile     # install workspace deps
bun run dev                       # Node dev server (tsx server/server.ts)
bun run format-and-lint:fix       # Biome format + lint (autofix)
bun run typecheck                 # next typegen + tsc --noEmit
bun run test:ci                   # check:bundler + Vitest (excludes real deploy test)
bun run build                     # check:bundler + esbuild server bundle + next build
bun run migration:generate        # Drizzle: generate SQL from schema changes
bun run migration:run             # apply migrations
bun run setup                     # full local bootstrap (Swarm/Traefik/Postgres/migrations)
bun run docker:build              # build the app Docker image
bun run check:bundler             # assert no Webpack/legacy-turbo opt-out crept in
```

## Local Documentation

The installed Next.js package ships bundled docs under
`apps/docklands/node_modules/next/dist/docs`. This repo currently has
Next `16.2.9`; check those local docs before relying on memory or web search for
Next behavior.

```sh
rg -n "Route Handlers|App Router|Server Actions" apps/docklands/node_modules/next/dist/docs
```

## Repo-Wide Hard Rules

- Do not reintroduce AI features or AI dependencies. The AI router, schema,
  service, provider utilities, settings page, project assistant, and log analyzer
  were intentionally removed.
- Do not reintroduce proprietary, commercial-license, or hosted-only code paths
  unless the user explicitly asks and the licensing implications are reviewed.
  Docklands is intended to carry only Apache-2.0-compatible code.
- Preserve the workspace split. `apps/docklands` is the self-hosted product;
  future public site/docs apps should be separate deployables.
- Do not add `packages/` until there is real shared code needed by at least two
  apps that cannot live cleanly in one app.
- Treat security-sensitive changes (auth, secrets, Docker/runtime execution,
  deployment commands, backups, domains, TLS, webhooks, providers, dependency or
  toolchain behavior) as test-worthy.
- Do not weaken type safety or disable strictness globally to get past upgrade
  friction.
- Avoid touching generated output such as `.next/`, `dist/`, and `node_modules/`.

## Dependency And Migration Notes

- **Turbopack only.** Next 16 uses Turbopack by default, and Docklands makes it
  explicit: `next build --turbopack`, `turbopack: true` in the custom server, and
  a pinned Turbopack root in `next.config.mjs`. Do not add custom Webpack config,
  Webpack opt-out env vars, `--webpack`, or legacy `--turbo` flags.
  `bun run build` and `bun run test:ci` run `check:bundler`; run
  `bun run check:bundler` directly after bundler/tooling changes.
- **Tailwind 4** uses `apps/docklands/postcss.config.cjs` with
  `@tailwindcss/postcss`; do not switch back to `tailwindcss` as a PostCSS plugin.
  `apps/docklands/app/globals.css` uses `@import "tailwindcss";` and
  `@config "../tailwind.config.ts";`.
- React Email uses `render`, not `renderAsync`.
- xterm uses `@xterm/addon-fit`, not the old `xterm-addon-fit`.
- Node provides `File`; only a minimal server-side `FileList` shim lives in
  `apps/docklands/shared/validation/schema.ts`.
- If you remove or change a database table or field, generate a Drizzle migration
  and commit both the SQL and the matching `apps/docklands/drizzle/meta`
  snapshot/journal updates. Do not hand-edit generated snapshots unless you are
  deliberately repairing a generated migration.

## Branding

The product name is Docklands. Active code, user-facing copy, package names,
Docker resources, and runtime paths should use Docklands naming. `README`,
`NOTICE`, `LICENSE.MD`, and other historical/legal docs may still mention the
upstream project where attribution requires it.

## Before Finishing

For code changes, aim to run:

```sh
bun run format-and-lint:fix
bun run typecheck
bun run test:ci
bun run build
```

For docs-only changes, at minimum run `git diff --check`. `bun run build` may need
permission to create a local `tsx` IPC pipe and to spawn Turbopack/CSS workers;
build output is noisy without local Postgres/Docker secrets — what matters is
that it exits successfully. Prefer the non-real Vitest command above for routine
changes; the real deployment test needs Docker socket access and build tooling.
