# Docklands

Docklands is a community fork of the upstream self-hosted deployment platform at [dokploy/dokploy](https://github.com/dokploy/dokploy), focused on a cleaner deployment control plane with a more deliberate product direction.

The current branch starts from upstream `canary`, keeps the useful base, and adds a small curated set of reviewed fixes. The next major workstream is the Docklands identity and UI refresh.

## Status

Docklands is early and should be treated as a fork-in-progress.

- Forked from the upstream project and kept on `canary`.
- Extra upstream branches were removed from this fork; only `canary` and `main` are kept.
- A first batch of security-positive upstream PRs was merged after review.
- Remaining upstream PRs are intentionally not mass-merged. Most need dedicated security or product review.

## What It Does

Docklands inherits the upstream project's core capabilities:

- Deploy applications from Git, Docker images, and Docker Compose.
- Manage PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and libSQL services.
- Route traffic through Traefik.
- Run database and volume backups.
- Manage multi-server Docker deployments.
- Monitor deployments, logs, resources, and service state.
- Send deployment notifications through configured providers.

## Development

Docklands is now organized as a small pnpm workspace. The only app today is the
self-hosted Docklands control plane in `apps/docklands`; future public landing
and docs sites can be added as separate deployables under `apps/`.

```bash
pnpm install --frozen-lockfile
cp apps/docklands/.env.example apps/docklands/.env
pnpm setup
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test
```

Docklands targets Node `>=24.4.0 <26` and pnpm `>=10.22.0`.

### Layout

- `apps/docklands/` contains the installable Next.js app users run on their own VM.
- `apps/docklands/app/` contains the Next.js App Router UI and route handlers.
- `apps/docklands/components/` contains dashboard, shared, layout, auth, and primitive UI components.
- `apps/docklands/client/` contains browser-only app glue such as tRPC, auth client helpers, and hooks.
- `apps/docklands/shared/` contains cross-runtime validation and utility helpers.
- `apps/docklands/server/` contains the custom server, tRPC routers, queues, WebSocket glue, ops scripts, and backend runtime.
- `apps/docklands/server/core/` contains backend/domain code: database, services, Docker, Traefik, deployments, backups, auth, templates, and verification.
- `apps/docklands/tools/` contains app-coupled utilities such as OpenAPI generation.
- `apps/docklands/drizzle/` contains database migrations.
- `apps/docklands/__test__/` contains the Vitest suite.
- `tools/` contains repository-level release/build helpers such as Docker image scripts.

Cloud-only worker apps and source-available/proprietary upstream code have been
removed from this fork.

## Security And PR Policy

Docklands does not blindly merge the upstream PR backlog.

PRs that touch auth, secrets, Docker/runtime execution, deployment commands, backups, domains, TLS, webhooks, cloud providers, or dependency/toolchain behavior require a focused security review before merge.

The first backlog audit is stored outside the repository in the Codex workspace output:

```text
outputs/docklands-pr-security-audit.md
```

## Attribution

Docklands started as a fork of the upstream project. The original project, contributors, and licensing remain important context. See:

- [Original upstream](https://github.com/dokploy/dokploy)
- [LICENSE.MD](LICENSE.MD)
- [NOTICE](NOTICE)

Docklands is intended to carry only Apache-2.0-compatible code. Upstream source-available/proprietary components have been removed rather than rebranded.

## Contributing

This fork is still being shaped. For now, keep changes small, review security-sensitive behavior carefully, and prefer focused PRs over broad rewrites.
