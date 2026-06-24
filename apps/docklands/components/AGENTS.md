# Frontend component conventions

This file documents the durable UI/engineering patterns for `apps/docklands`'s
React frontend (`components/`, `app/`, `client/`). It is the contract for writing
new UI so the frontend stays resilient, consistent, and DRY. Repo-wide rules live
in the root `AGENTS.md`; the app's backend/domain rules live in
`apps/docklands/AGENTS.md`. Read those too.

The component tree is: thin RSC `page.tsx` (auth-gate + `await params`) → a
`"use client"` boundary → feature folders under `components/dashboard/*` over a
`components/shared/` primitive layer. Cross-runtime helpers with no React live in
`shared/`.

## Failure-mode engineering is mandatory

Every async surface must degrade visibly, never silently. The frontend has a
real resilience layer — use it instead of re-introducing silent failures.

- **Global error handling is already wired.** `client/providers/trpc-provider.tsx`
  installs `QueryCache`/`MutationCache` `onError` that classify and surface errors
  via `client/lib/trpc-error.ts` (`UNAUTHORIZED` → login redirect, `FORBIDDEN`/
  generic → toast, network → retry). You do **not** need bespoke error plumbing
  for a failure to be visible.
- **Route segments get boundaries.** New top-level route areas should have an
  `error.tsx` (render `RouteError` from `components/shared/route-error`) and,
  where the route does real async work, a `loading.tsx` skeleton. `app/global-error.tsx`
  is the last resort.
- **Independently-throwable subtrees get an `ErrorBoundary`.** Wrap drawer tabs,
  dialog bodies, and similar with `ErrorBoundary` from
  `components/shared/error-boundary` (keyed by the active tab/route so it
  auto-recovers on navigation). One panel's throw must not unmount its siblings.
- **List/section states come from `components/shared/states.tsx`.** Use
  `QueryState` for "a list backed by one query" (it renders `LoadingState` while
  pending, a retryable `ErrorState` on failure — not a silent empty list — the
  `empty` node when empty, else `children(data)`), or compose `LoadingState` /
  `EmptyState` / `ErrorState` directly. Do **not** hand-roll the
  `min-h-[25vh] flex items-center justify-center` spinner/empty ladder again, and
  never branch only on `isPending`/`data` (that swallows `isError`).

## Mutations: declarative, with cache invalidation

- Use `crudMutationOptions` from `client/lib/crud-mutation` for create/update/
  delete mutations: pass it into `api.<router>.<proc>.useMutation(...)` and it
  produces standard `{onSuccess,onError,onSettled}` with toast + scoped logging +
  cache invalidation. The call site stays fully typed.
- Prefer `mutate(payload)` + the mutation's own `isPending` (for button `loading`)
  over `mutateAsync().then().catch()`. Never leave a `mutateAsync` un-awaited, and
  do not mix `await` with `.then`.
- **Invalidate, don't refetch.** `utils.<router>.invalidate()` in the success
  callback refreshes every subscriber; `refetch()` only refreshes the caller and
  leaves siblings stale. Reserve `refetch()` for explicit user-triggered reloads.
  Invalidate the full set an entity touches (e.g. creating a service invalidates
  the environment graph **and** `workspaces.all` so counts update).
- If a dialog already shows an inline `AlertBlock` bound to `isError`, pass
  `toastError: false` so the failure isn't double-surfaced (it's still logged).

## Registry over per-variant duplication

When you have N variants of the same shape (database engines, notification
providers), drive them from a single registry/config record and a generic
renderer — never copy a CRUD/form/dispatch block per variant. Database engines
(`shared/database-engines.ts`) and the notification `submitDispatch`/`testDispatch`
registries are the reference. **Caveat:** only collapse what is genuinely uniform.
Variants with fundamentally different flows (e.g. the GitHub-App manifest setup
vs. a token form) or different fields/validation should stay distinct — a lossy
"one config for all" is worse than honest separation.

## Module boundaries

- One app must never import another app's source (`apps/docklands` vs `apps/site`
  vs `apps/docs`).
- `shared/` (cross-runtime) must not import from `components/`, `app/`, or
  `server/`. Dependencies point *down* toward primitives, never *up* into feature
  or server code.
- A feature subtree under `components/dashboard/<feature>/` should not import a
  helper from a sibling feature subtree. Genuinely shared helpers belong in
  `components/shared/` (React) or `shared/` (pure), or in
  `components/dashboard/shared/` for shared dashboard widgets.
- Don't create two same-named exports in one folder (the `ShowEnvironment`
  collision was renamed to `ShowApplicationEnvironment` / `ShowServiceEnvironment`
  to kill aliased imports). Name for the call site, not the folder.

## Styling: Kumo-first

- Cloudflare Kumo (`@cloudflare/kumo`) is the component library; reach for a Kumo
  primitive (`Button`/`LinkButton`, `SensitiveInput`, `Combobox`, `Tabs`, …)
  before hand-rolling. Check `apps/docklands/node_modules/@cloudflare/kumo` types
  for the required compound-component composition before guessing.
- Use Kumo tokens (`bg-kumo-*`, `text-kumo-*`, `border-kumo-line`). The legacy
  shadcn tokens (`bg-input`, `*-muted-foreground`, `bg-background`,
  `text-foreground`, `border-input`) are **not defined** in this app and resolve
  to nothing — never reintroduce them.
- `cn()` is single-sourced from `@/shared/utils`. Dark mode is `[data-mode="dark"]`.
- Read form values from React (controlled state / `useRef` / RHF), never via
  `document.querySelector` by placeholder text.

## Permissions & navigation

- `shared/dashboard-nav.ts` (`DASHBOARD_MENU`) is the single source of truth for
  routes, labels, and permission gates. Derive any secondary nav surface from it
  (see `navShortcutsForUrls`); don't maintain a parallel hardcoded list.
- Read permissions through `usePermissions()` — `permissions?.<resource>.<action>`
  or the typed `can(resource, action)` (typos fail at compile time).
