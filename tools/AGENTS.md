# AGENTS.md

`tools/` contains repository-level development and release scripts.

- Tools may coordinate app packages or release artifacts, but they should not be required at production runtime.
- App-coupled tools that import Docklands internals belong in `apps/docklands/tools/`.
- Production startup, migration, and recovery entrypoints belong in `apps/docklands/server/ops/`, not here.
- Prefer typed imports and existing project config over shelling out.
- If a tool writes generated output, document the command in `README.md` or the root `AGENTS.md`.
