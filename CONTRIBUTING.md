# Contributing

Thanks for helping shape Docklands.

Docklands is a community fork of Dokploy focused on a self-hosted deployment
control plane. Keep changes focused, test security-sensitive behavior carefully,
and prefer small PRs over broad rewrites.

## Setup

Use Node 24.x and pnpm 10.x.

```bash
git clone https://github.com/jason301c/docklands.git
cd docklands
pnpm install --frozen-lockfile
cp .env.example .env
pnpm setup
pnpm dev
```

The app runs at http://localhost:3000.

## Layout

- `pages/`, `components/`, `server/`, and `utils/` are the web app.
- `server/core/` is the folded-in backend/domain layer from upstream's old server package.
- `drizzle/` contains migrations.
- `__test__/` contains Vitest tests.

The old upstream `apps/*` and `packages/*` workspace layout is intentionally
gone in this fork.

## Checks

Run the relevant checks before opening a PR:

```bash
pnpm typecheck
pnpm test
pnpm format-and-lint
```

## Pull Requests

- Branch from `canary`.
- Use Conventional Commits where practical, for example `fix: redact deploy secrets`.
- Include tests for behavior changes.
- Update docs when commands, env vars, setup steps, or user-visible behavior changes.
- Avoid drive-by formatting or unrelated cleanup in feature PRs.

Auth, secrets, Docker/runtime execution, deployment commands, backups, domains,
TLS, webhooks, provider integrations, dependencies, and build tooling all need
focused security review.
