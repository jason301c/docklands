# AGENTS.md

`client/` contains browser-only glue for the Next.js app.

- Keep Node-only modules, server services, filesystem access, Docker access, and database imports out of this tree.
- `client/api/trpc.ts` is the browser tRPC entrypoint.
- `client/providers/` should only contain React providers and client-side context wiring.
- `client/auth/` should configure Better Auth's browser client only; server auth belongs in `server/core/lib/auth.ts`.
- `client/hooks/` should be reusable browser hooks. If a hook needs backend data, call through the typed tRPC client.
