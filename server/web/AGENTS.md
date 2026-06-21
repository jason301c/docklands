# AGENTS.md

`server/web/` contains non-tRPC HTTP flows used by App Router route handlers.

- Treat deploy webhooks, provider webhooks, and OAuth callbacks as hostile-input boundaries.
- Validate refresh tokens, provider signatures, callback state, and target resources before mutating deployments or credentials.
- `next-api-compat.ts` exists only to bridge legacy handler logic into App Router route handlers. Remove it handler-by-handler when the rewritten route has equivalent tests.
- Keep response semantics compatible with external providers; small status-code changes can break webhook integrations.
