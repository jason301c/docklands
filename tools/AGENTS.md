# AGENTS.md

`tools/` contains development-only scripts.

- Tools may read application code and emit generated artifacts, but they should not be required at production runtime.
- Production startup, migration, and recovery entrypoints belong in `server/ops/`, not here.
- Prefer typed imports and existing project config over shelling out.
- If a tool writes generated output, document the command in `README.md` or the root `AGENTS.md`.
