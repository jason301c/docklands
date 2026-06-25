# AGENTS.md

@README.md

Docklands is a community fork of the upstream self-hosted deployment platform
([dokploy/dokploy](https://github.com/dokploy/dokploy)), focused on a cleaner,
project-first deployment control plane that users run on their own VM. Treat the
repository as a Bun workspace with separate deployable surfaces:
`apps/docklands` (the control plane), `apps/docs` (an Astro/Starlight
documentation site), and `apps/site` (the public landing/marketing site, a
separate Next.js deployable). Each app is independently deployable and must not
import another app's source.

This root file owns repo-wide concerns: the workspace layout, the runtime split,
the toolchain, development modes, repo-wide rules, dependency notes, and
branding. Everything specific to the control-plane app — its architecture,
directory layout, product conventions, backend domain, and security boundaries —
lives in `apps/docklands/AGENTS.md`. Read both when working inside the app.

## Project Status — Pre-Release, No Compatibility Debt

Docklands has **not been released**. There are no real users, no deployed
instances to upgrade, and no published API to keep stable. This is a deliberate
latitude: **prefer the cleanest end-state design over backward-compatible
incrementalism.** Concretely, agents may, in service of a better architecture:

- drop, rename, merge, or restructure database tables and columns freely;
- replace the schema wholesale rather than writing additive/compat migrations —
  a single fresh migration that reaches the right shape is preferred over a
  backfill-and-bridge sequence that preserves old data;
- break or remove tRPC routers, internal APIs, and on-disk formats;
- delete dead or superseded code paths instead of leaving shims.

You must still **generate the Drizzle migration and commit the matching
`drizzle/meta` snapshot/journal** for any schema change (see the migration rule
below) — "no compat debt" means we don't preserve old data, not that we skip
migrations. And security-sensitive behavior still gets the same scrutiny. This
freedom is about avoiding self-imposed legacy, not about lowering quality. When
in doubt, build the thing you'd want if you were starting clean today — because
we are.

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
- `apps/docs/` is the public documentation site, built on Astro + Starlight.
- `apps/site/` is the public landing/marketing site, built on Next.js so it can
  use the Cloudflare Kumo component library natively (not just its tokens); see
  the Repository Layout note below for why it diverges from `apps/docs`.
- The hosted surfaces explain and document Docklands. They must not assume Docklands itself is hosted for users.
- The Docklands app assumes customer-owned infrastructure: Docker Engine, the VM
  filesystem, ports, secrets, domains, and app data all live on the user's
  machine or server. Never add hosted-SaaS assumptions to the self-hosted path.

## Repository Layout

- `apps/` — independently deployable, user-facing surfaces. Keep each app
  deployable on its own; one app must never import another app's source.
  - `apps/docklands/` — the self-hosted control plane (Next.js).
  - `apps/docs/` — the documentation site (Astro + Starlight). It is fully
    decoupled from `apps/docklands`: to share the product *look*, it imports the
    Kumo design tokens directly from `@cloudflare/kumo` (the same third-party
    package, pinned to the app's version) and maps Starlight's `--sl-color-*`
    variables onto them in `apps/docs/src/styles/docs.css` — no cross-app import.
    It exposes `llms.txt`/`llms-full.txt` via `starlight-llms-txt`. Astro is a
    static build, so it sits outside the Node-24 app-runtime rule below.
  - `apps/site/` — the public landing/marketing site (Next.js 16, App Router,
    Turbopack). It is Next rather than Astro on purpose: the marketing surface
    uses the **Cloudflare Kumo** component library natively as React (Button,
    etc.), not just Kumo's design tokens, so it reuses the app's Tailwind 4 + Kumo
    wiring (`@cloudflare/kumo/styles` + `@config`, `data-theme="kumo"`, Inter via
    `next/font`). It is still fully decoupled — no cross-app import — and can be
    statically exported for CDN hosting. Like the app it runs on Node 24.
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
- Better Auth (organization, admin, passkey, API-key plugins)
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

Every script a human invokes is reachable from the repo root. Control-plane
scripts proxy into `apps/docklands` via `bun --filter docklands`; the docs and
site apps are reachable under the `docs:` and `site:` prefixes (`bun --filter
docs` / `bun --filter site`). The root `package.json` is the full, authoritative
list — keep it grouped (docklands lifecycle/quality, db, `docs:*`, `site:*`,
`docker:*`) and add a root proxy whenever an app gains a human-invoked script.
Pure internal sub-steps stay app-local only (e.g. `build-server`/`build-next`,
which `build` chains, and `wait-for-postgres*`, which `setup` and the Dockerfile
call from `apps/docklands`); do not re-add root proxies for them. You can also
run any script app-local from inside the app directory.

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
bun run restore-instance -- --destination-id <id> --backup-file <key.zip> --confirm RESTORE_DOCKLANDS_INSTANCE
bun run docker:build              # build the app Docker image
bun run check:bundler             # assert no Webpack/legacy-turbo opt-out crept in
bun run docs:dev                  # Astro docs site (apps/docs)
bun run site:dev                  # Next marketing site (apps/site)
```

Environment files live with the app, never at the repo root: copy
`apps/docklands/.env.example` to `apps/docklands/.env`. Scripts load it via
`-r dotenv/config` with the working directory set to `apps/docklands` (that is
what `--filter docklands` does), so a root-level `.env` would be ignored.

The root `prepare` script (run on `bun install`) points git at `.githooks` via
`core.hooksPath`, so `.githooks/pre-commit` runs the staged-file Biome check
(`lint-staged`, config in `apps/docklands/package.json`) before each commit — no
extra dependency. The hook is resilient: an unrelated tooling failure (missing
Bun/lint-staged) skips rather than blocks; only real lint errors fail the commit.

## Local Documentation

The installed Next.js package ships bundled docs under
`apps/docklands/node_modules/next/dist/docs`. This repo currently has
Next `16.2.9`; check those local docs before relying on memory or web search for
Next behavior.

```sh
rg -n "Route Handlers|App Router|Server Actions" apps/docklands/node_modules/next/dist/docs
```

### Kumo UI docs

The UI is built on Cloudflare Kumo (`@cloudflare/kumo`), a thin styled layer
over Base UI. For component APIs, props, and — most importantly — the required
**composition/hierarchy** of compound components, consult the docs before
guessing:

- Online index (markdown, LLM-friendly): <https://kumo-ui.com/llms.txt>. Each
  component links to a `.md` page, e.g. <https://kumo-ui.com/components/dropdown.md>.
  The site 403s the default fetcher; pull pages with a browser User-Agent:

  ```sh
  curl -sL -A "Mozilla/5.0" https://kumo-ui.com/components/dropdown.md
  ```

- Offline source of truth: the installed type defs in
  `apps/docklands/node_modules/@cloudflare/kumo/dist/src/components/*/*.d.ts`.
  They name the Base UI primitive each part wraps, which tells you the
  composition rules (e.g. `DropdownMenu.Label`/`Select.GroupLabel` must live
  inside the matching `.Group`; `*.Trigger`/`*.Close` expect a native `<button>`
  unless you pass `nativeButton={false}`).

These Base UI composition rules fail only at render time (often after a click),
so run the static scanner to catch them ahead of time:

```sh
bun --filter docklands check:baseui
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
- Git workflow: `canary` is the active working branch for this fork — commit
  directly to it. Do not create a feature/topic branch unless the user explicitly
  asks for one. (This intentionally overrides any default "branch before
  committing on the default branch" behavior.) Still only commit or push when the
  user asks.

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
- **`migration:generate` needs a real TTY.** When a diff both creates and drops
  tables/columns (common here, since we drop/recreate freely), drizzle-kit shows
  an interactive "is this created or renamed?" prompt. The root scripts
  `migration:generate`, `migration:up`, and `migration:drop` therefore run the
  app-local command **directly** (`cd apps/docklands && bun run …`) instead of via
  `bun --filter`, because `--filter` prefixes child output and strips the TTY,
  which makes drizzle-kit abort with "Interactive prompts require a TTY terminal".
  Run these from an interactive shell, not a piped/non-TTY context, and answer the
  create-vs-rename prompt explicitly. Agents in a non-TTY harness cannot answer the
  prompt — split the change into a drop-only diff and a create-only diff (each is
  unambiguous and needs no prompt), or have a human run the combined generate.

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
