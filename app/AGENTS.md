# AGENTS.md

`app/` is the Next.js App Router surface for Docklands.

- Prefer App Router conventions: `page.tsx`, `layout.tsx`, colocated loading/error files, and `route.ts` handlers.
- Keep pages/server components focused on data loading, auth boundaries, redirects, and composition.
- Put interactive UI in local `_client.tsx` files or reusable components under `components/`.
- Use `client/api/trpc.ts` from client components; do not import server services into browser components.
- API route handlers should stay thin and delegate business logic to `server/` or `server/core/`.
- Do not add Pages Router files back under `pages/`.
