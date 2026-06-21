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

Docklands is currently a single root app. The old upstream workspace layout was
collapsed so the Next.js app, backend runtime, tests, and Docker build all live
from the repository root.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm setup
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test
```

The upstream project currently declares Node `^24.4.0`, so use Node 24.x for CI-quality validation.

### Layout

- `pages/`, `components/`, `server/`, and `utils/` contain the Docklands web app.
- `server-core/` contains the backend/domain code folded in from the old upstream server package.
- `drizzle/` contains database migrations.
- `__test__/` contains the Vitest suite.

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
