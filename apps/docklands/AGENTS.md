# AGENTS.md

`apps/docklands/` is the installable Docklands control plane that users run on their own VM.

- Keep this package self-contained: Next.js app, colocated backend, runtime services, migrations, tests, public assets, and app-specific tooling live here.
- Do not add hosted-SaaS assumptions. The app must work as customer-owned infrastructure with local Docker, filesystem state, ports, secrets, domains, and databases.
- Use tRPC for the app frontend/backend contract. Keep OpenAPI as the machine-readable API layer, but do not reintroduce Swagger UI.
- Runtime/admin entrypoints belong in `server/ops/`; app-coupled development scripts belong in `tools/`; repository-level release scripts belong in `../../tools/`.
- The Dockerfile builds this app from the workspace root context so pnpm can install the workspace consistently.
- You can run commands either through root scripts, such as `pnpm typecheck`, or from this directory with the app-local scripts.
