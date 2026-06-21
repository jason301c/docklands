# AGENTS.md

`app/api/` contains App Router route handlers.

- Route handlers should translate `Request` objects into calls to tRPC, auth, or `server/web/` helpers; avoid embedding deployment, provider, auth, or Docker logic here.
- Non-tRPC webhook, provider, and deploy logic should live in `server/web/` and be called from thin route handlers.
- Return standard `Response`/`NextResponse` values and keep runtime assumptions explicit when Node APIs are required.
