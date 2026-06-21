# AGENTS.md

`__test__/` contains Vitest coverage for Docklands.

- Prefer focused tests around behavior changed by the patch.
- Mock network, Docker, filesystem, and process execution unless the file is explicitly a real integration test.
- Keep `__test__/deploy/application.real.test.ts` out of the routine suite unless the local machine is prepared for real deployment work.
- Update fixtures when schema fields are removed; do not keep dead fields in test objects.
