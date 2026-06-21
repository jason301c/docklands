# AGENTS.md

`__test__/` contains Vitest coverage for Docklands.

- Prefer focused tests around permission, security, deployment, queue, Docker/Traefik, and webhook behavior when those areas change.
- Mock network, Docker, filesystem, and process execution unless the test is explicitly a real integration test.
- Keep `__test__/deploy/application.real.test.ts` out of the routine suite unless the local machine is prepared for real deployment work.
- Update fixtures when schema fields are removed; do not keep dead enterprise/license/SSO fields in test objects.
- Use the shared Vitest config: `pnpm exec vitest --config __test__/vitest.config.ts --run --exclude __test__/deploy/application.real.test.ts`.
