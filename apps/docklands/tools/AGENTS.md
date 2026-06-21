# AGENTS.md

`apps/docklands/tools/` contains development scripts coupled to the Docklands app source.

- Keep scripts here when they import app internals such as `server/api/root` or emit app-owned generated artifacts.
- `generate-openapi.ts` writes `openapi.json` for docs/tooling consumers while preserving the OpenAPI runtime surface.
- Production startup, migration, recovery, and setup entrypoints belong in `server/ops/`, not here.
