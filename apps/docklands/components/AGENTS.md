# AGENTS.md

`components/` is for React UI, not backend logic.

- Use `components/ui/` primitives and existing dashboard patterns before adding new component styles.
- Use `shared/utils.ts` for `cn` and cross-runtime helpers.
- Keep server actions, database calls, Docker calls, and filesystem work out of components.
- Browser data access should go through `client/api/trpc.ts` and client hooks.
- For settings and deployment controls, show clear state, loading, error, and confirmation behavior; these screens operate real infrastructure.
