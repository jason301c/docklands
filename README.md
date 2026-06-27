# Docklands

Docklands is a community fork of the upstream self-hosted deployment platform at [dokploy/dokploy](https://github.com/dokploy/dokploy), focused on a cleaner deployment control plane with a more deliberate product direction.

The current branch starts from upstream `canary`, keeps the useful base, and is moving the product toward a project-first workspace experience for self-hosted VM operators.

## Status

Docklands is early and should be treated as a fork-in-progress.

- Forked from the upstream project and kept on `canary`.
- Extra upstream branches were removed from this fork; only `canary` and `main` are kept.
- A first batch of security-positive upstream PRs was merged after review.
- Remaining upstream PRs are intentionally not mass-merged. Most need dedicated security or product review.
- The primary project environment view is now a workspace canvas with persisted service layout, service connections, generated connection variables, service variables, deployments, domains, previews, topology grouping, and command-bar navigation.
- The `/dashboard/workspace` overview is the single workspace surface: it lists workspaces with per-row management (rename, tags, delete) alongside the stats and recent activity, and the per-environment canvas owns the bulk service operations (multi-select deploy, move, duplicate, and delete).

## What It Does

Docklands inherits the upstream project's core capabilities:

- Deploy applications from Git, Docker images, and Docker Compose.
- Manage PostgreSQL, MySQL, MariaDB, MongoDB, Redis, and libSQL services.
- Arrange services on a project canvas and model private service-to-service connections.
- Apply generated database/cache connection variables to connected services.
- Route traffic through the Docklands ingress runtime, powered by Traefik under the hood.
- Expose apps over a Cloudflare Tunnel (the default, beginner-first path) — no open ports, public IP, manual DNS, or certificate setup — or the classic public-IP path.
- Run database and volume backups.
- Manage local and remote runtime workers for multi-machine container builds.
- Inspect deployments, logs, metrics, resources, and service state.
- Send deployment notifications through configured providers.

## Product Surface

The primary app surface is `/dashboard/workspace`: a project environment canvas
for services, variables, deployments, domains, previews, topology, and connection
mapping.
Older inherited dashboard routes are no longer preserved as compatibility
redirects; new navigation and docs should use the workspace-first route model.

Preferred route names in docs, navigation, and new links:

- `/dashboard/workspace` for the project overview.
- `/dashboard/runtime` for runtime monitoring (Containers · Cluster · Host Metrics tabs).
- `/dashboard/ingress` for ingress observability (Requests · Files tabs).
- `/dashboard/deployments` for deployment history and worker queue state.
- `/dashboard/settings/cloudflare` for the Cloudflare Tunnel connection.
- `/dashboard/settings/ingress`, `/dashboard/settings/runtime`, and `/dashboard/settings/storage` for the renamed settings surfaces.

`/dashboard/automations` is reserved for scheduled tasks, but that surface is
planned and not implemented yet, so it is not a usable page today. Domain
management is likewise not an aggregate page: domains are configured per service
on the workspace canvas, and the related settings live under the Cloudflare,
Ingress, and Certificates groups rather than a single Domains screen.

## Install

Install Docklands on a Linux server with one command, run as root:

```bash
curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh | sudo sh
```

It installs Docker if missing, generates and persists secrets to
`/etc/docklands`, initializes Swarm + Traefik + bundled Postgres (via the image's
`setup-instance` entrypoint), starts the dashboard, and prints the URL. Re-run
with `... | sudo sh -s -- update` to upgrade in place.

**On a Mac (e.g. a Mac mini):** the Docklands server is Linux, so the *same*
command boots a [Lima](https://lima-vm.io) VM and runs the install inside it
(installing Lima via Homebrew if needed); the dashboard is forwarded to
`http://localhost:3000`. For public app domains without opening ports, use the
Cloudflare Tunnel ingress mode.

Docklands is pre-release: the image is published by CI on every `canary` push
(`jason301c/docklands:canary`) and will publish `:latest` at the first tagged
release. Until then, pass `DOCKLANDS_IMAGE=jason301c/docklands:canary`. See
[the production install guide](apps/docs/src/content/docs/install/production.md)
for the manual/advanced path.

## Development

Docklands is now organized as a small Bun workspace: the self-hosted Docklands
control plane in `apps/docklands` and an Astro + Starlight documentation site in
`apps/docs`. A future public landing site can be added as another separate
deployable under `apps/`.

Bun and Node have separate jobs here: **Bun is the package manager and task
runner**, while **Node 24 is the runtime that actually runs the app** in both
development and production. Pin Node with the repo `.nvmrc` (`24.4.0`) using a
version manager such as [fnm](https://github.com/Schniz/fnm) so the right Node
is selected automatically; do not rely on Homebrew's rolling `node`, which will
drift past the supported range.

There are exactly two ways to run Docklands while developing it:

**Local mode** — the everyday loop for UI and backend work:

```bash
bun install --frozen-lockfile
cp apps/docklands/.env.example apps/docklands/.env
bun run dev
```

`bun run dev` is one self-healing command: it generates local dev secrets,
ensures a local Postgres (a throwaway `docklands-dev-postgres` container unless
`DATABASE_URL` already points at a running database), applies migrations, and
starts the control plane on `http://localhost:3000`. It deliberately does **not**
initialize Swarm/Traefik, so it stays fast — but deploy and ingress flows are not
exercised in Local mode.

**Replica mode** — a disposable Linux VM that faithfully mirrors a self-hosted
install (real Docker Engine, Swarm, Traefik, `/etc/docklands`). Use it for
anything that touches infrastructure: deploys, ingress, backups, remote workers.
You edit it from your machine over Remote-SSH and browse it via forwarded ports.

```bash
bun run replica:up     # boot the VM (needs Lima: `brew install lima`)
bun run replica:ssh    # shell in; then: cd /workspace && bun install && bun run dev
```

For the **closest-to-production dev loop**, run `bun run dev:host` inside the
replica instead of `bun run dev`: it runs the real `setup-instance` (Swarm +
Traefik) first, so deploys and ingress hit the production code paths while your
source still hot-reloads. It refuses to run on macOS (it mutates the host Docker
daemon), so it only ever touches the VM.

See `tools/replica/README.md` for the replica blueprint and
`tools/verify/README.md` for the `verify:*` harness that exercises the install,
deploy, upgrade, backup, and remote-worker paths.

**Verifying the install paths** — `bun run verify` runs the same proven
assertions (Swarm init, the `docklands-network` overlay, first-owner bootstrap,
deploy + generated Traefik ingress, whole-instance backup, same-image container
replacement) against either of two substrates:

```bash
# Sandbox (default): an isolated Docker-in-Docker daemon. It sets up Swarm +
# docklands-network *inside* the sandbox and tears it all down, so it never
# touches your host's Docker. Portable — runs on any laptop with Docker, no VM.
docker build -t docklands:local-verify -f apps/docklands/Dockerfile .
bun run verify -- --image docklands:local-verify

# Host: against an already-installed instance (real setup-instance: host Swarm,
# /etc/docklands, Traefik on :80). Run this inside a replica after installing the
# image there, to also prove the live port-80 ingress route.
bun run verify -- --target host
```

The sandbox is what CI runs and what gates pull requests; the host target inside
a replica is the highest-fidelity check before a release. Release verification
always runs on amd64 in CI, since most servers are amd64 (see the architecture
note in `tools/replica/README.md`).

Useful checks:

```bash
bun run typecheck
bun run test:ci
bun run build
```

Docklands targets Node `>=24.4.0 <26` and Bun `>=1.3.14`.

### Layout

- `apps/docklands/` contains the installable Next.js app users run on their own VM.
- `apps/docs/` contains the Astro + Starlight documentation site (decoupled from
  the app; it borrows the Kumo design tokens for a shared look and exposes
  `llms.txt`).
- `apps/docklands/app/` contains the Next.js App Router UI and route handlers.
- `apps/docklands/components/` contains dashboard, shared, layout, auth, and primitive UI components.
- `apps/docklands/client/` contains browser-only app glue such as tRPC, auth client helpers, and hooks.
- `apps/docklands/shared/` contains cross-runtime validation and utility helpers.
- `apps/docklands/server/` contains the custom server, tRPC routers, queues, WebSocket glue, ops scripts, and backend runtime.
- `apps/docklands/server/core/` contains backend/domain code: database, services, container runtime, ingress, deployments, backups, auth, templates, and verification.
- `apps/docklands/tools/` contains app-coupled utilities such as OpenAPI generation.
- `apps/docklands/drizzle/` contains database migrations.
- `apps/docklands/__test__/` contains the Vitest suite.
- `tools/` contains repository-level release/build helpers such as Docker image scripts.

Cloud-only worker apps and source-available/proprietary upstream code have been
removed from this fork.

## Security And PR Policy

Docklands does not blindly merge the upstream PR backlog.

PRs that touch auth, secrets, Docker/runtime execution, deployment commands, backups, domains, TLS, webhooks, cloud providers, or dependency/toolchain behavior require a focused security review before merge.

The first backlog audit is stored outside the repository in the Codex workspace output:

```text
outputs/docklands-pr-security-audit.md
```

## Attribution

Docklands started as a fork of the upstream project. The original project, contributors, and licensing remain important context. See:

- [Original upstream](https://github.com/dokploy/dokploy)
- [LICENSE.MD](LICENSE.MD)
- [NOTICE](NOTICE)

Docklands is intended to carry only Apache-2.0-compatible code. Upstream source-available/proprietary components have been removed rather than rebranded.

## Contributing

This fork is still being shaped. For now, keep changes small, review security-sensitive behavior carefully, and prefer focused PRs over broad rewrites.
