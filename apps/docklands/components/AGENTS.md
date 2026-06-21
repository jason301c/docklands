# AGENTS.md

`components/` is for React UI, not backend logic.

- Use imported styled Kumo components from `@cloudflare/kumo` or granular `@cloudflare/kumo/components/*` paths before creating app-owned compositions.
- App-owned compositions should live near their feature or in a clearly named shared folder. Do not recreate ShadCN/Radix-style primitives or reintroduce `components/ui/`.
- Use `shared/utils.ts` for `cn` and cross-runtime helpers.
- Keep server actions, database calls, Docker calls, and filesystem work out of components.
- Browser data access should go through `client/api/trpc.ts` and client hooks.
- For settings and deployment controls, show clear state, loading, error, and confirmation behavior; these screens operate real infrastructure.
