# AGENTS.md

`server/` is the colocated backend for the single Docklands app.

- `server/server.ts` owns the custom Next server and WebSocket attachment.
- `server/api/` owns tRPC routers. Keep routers thin: validate input, check permissions, audit meaningful changes, then call services.
- `server/web/` owns HTTP webhook/OAuth/deploy endpoints that are not normal UI tRPC flows.
- `server/queues/` owns deployment queue orchestration.
- `server/ops/` contains runtime/admin entrypoints that are bundled for production.
