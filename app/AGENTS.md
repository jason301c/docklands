# AGENTS.md

`app/` is the Next.js App Router surface for Docklands.

- Prefer App Router conventions: `page.tsx`, `layout.tsx`, and colocated loading/error files.
- Keep pages/server components focused on data loading, auth boundaries, redirects, and composition.
- Put interactive UI in local `_client.tsx` files or reusable components under `components/`.
- Use `client/api/trpc.ts` from client components; do not import server services into browser components.
- Do not add Pages Router files back under `pages/`.
