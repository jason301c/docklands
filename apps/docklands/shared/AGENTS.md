# AGENTS.md

`shared/` contains code that can be imported from both client and server.

- Keep this tree cross-runtime: no unguarded Node APIs, browser globals, Docker clients, database handles, or process mutation.
- Validation schemas that are used on both sides belong here, especially `shared/validation/schema.ts`.
- Generic formatting, slugging, class-name, icon, and password helpers are fine here when they have no server-side side effects.
- If a helper becomes backend-specific, move it to `server/core/`; if it becomes browser-specific, move it to `client/`.
