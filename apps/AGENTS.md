# AGENTS.md

`apps/` contains independently deployable user-facing surfaces.

- Keep each app deployable on its own. Do not make one app import another app's source.
- `apps/docklands/` is the only app today and is the self-hosted product runtime.
- Future `apps/site/` and `apps/docs/` should be public Astro deployables, not routes inside the Docklands Next.js app.
- Add shared packages only when two apps genuinely need the same runtime code.
