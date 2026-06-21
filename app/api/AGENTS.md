# AGENTS.md

`app/api/` contains App Router route handlers.

- Route handlers should translate HTTP to domain calls; avoid embedding deployment, provider, auth, or Docker logic here.
- Keep webhook and OAuth callback behavior security-focused: validate signatures, tokens, providers, and redirect targets before side effects.
- Legacy webhook/provider code may be wrapped through `server/web/next-api-compat.ts`; prefer deleting that compatibility layer only after rewriting the handler and covering it with tests.
- Return standard `Response`/`NextResponse` values and keep runtime assumptions explicit when Node APIs are required.
