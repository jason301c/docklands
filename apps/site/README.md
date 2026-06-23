# Docklands — Marketing Site (`apps/site`)

The public landing/marketing site for Docklands. Independently deployable Next.js
app (App Router, Turbopack), part of the Bun workspace alongside `apps/docklands`
(the self-hosted control plane) and `apps/docs` (the Starlight docs).

## Why Next.js here

Unlike `apps/docs` (Astro/Starlight), the marketing site is built in Next.js so it
can use the **Cloudflare Kumo** component library — the same UI library the
control plane uses — natively as React, instead of only borrowing Kumo's design
tokens. It shares the app's Tailwind 4 + Kumo wiring:

- `app/globals.css` imports `@cloudflare/kumo/styles` (registers the Kumo
  `@theme` tokens that generate the `*-kumo-*` utilities), Tailwind, the Kumo
  `@source` glob, and `@config ../tailwind.config.ts`.
- `<html data-theme="kumo">` selects the Kumo theme; `data-mode="dark"` toggles
  dark mode.
- Inter is loaded via `next/font` and exposed as `--font-inter`.

## Develop

From the repo root:

```sh
bun install
bun run site:dev      # next dev (this app)
bun run site:build    # next build
bun run site:start    # next start (after build)
```

Or app-local from `apps/site/`: `bun run dev` / `bun run build` / `bun run start`.

Lint/format use the workspace-root `biome.json` (no per-app Biome config):

```sh
bunx biome check --write apps/site
```

## Static export (optional)

This is a standard Next app today, so it can run as a Node server or be deployed
statically. To produce a fully static build for a CDN, set `output: "export"`
(and `images: { unoptimized: true }`) in `next.config.ts`. Note that doing so
disables server features such as `headers()`, ISR, and built-in image
optimization.

## Before launch

The outbound links and install command in `lib/site.ts` are **placeholders**
(GitHub repo, docs URL, canonical domain, one-line installer). Point them at the
real targets before shipping.
