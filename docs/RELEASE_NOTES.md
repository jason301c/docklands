# Docklands v0.1.0 Release Notes

Docklands v0.1.0 is the first self-hosted release candidate for this fork. It is
intended for operators who are comfortable running a deployment control plane on
their own VM, with Docker Engine, Swarm, Traefik, Postgres, domains, ports,
secrets, and backup storage under their control.

Do not tag or publish v0.1.0 until the release checklist in
`docs/PRODUCT_AUDIT.md` is complete on the pushed release ref.

## What Ships

- A self-hosted Next.js control plane running on Node 24.
- Workspace-first deployment management for applications, compose stacks, and
  managed databases.
- Deployments from Git repositories, Docker images, Dockerfile builds,
  Nixpacks, Railpack, Paketo/Buildpacks, static builds, and compose templates.
- Docker Swarm services on `docklands-network`, with Traefik ingress generated
  from Docklands domain records.
- A single instance organization with first-owner bootstrap, invite-only members,
  roles, custom roles, per-resource access, passkeys, and API keys.
- GitHub, GitLab, Gitea, and Bitbucket source connections for clone/deploy
  workflows. GitHub is the only provider with signed deploy webhooks and pull
  request preview deployments in this release.
- Managed Postgres, MySQL, MariaDB, MongoDB, Redis, and libSQL services through
  one database registry and one UI/service path.
- Database backups for engines with logical dump support, volume backups for
  filesystem-backed data, and whole-instance backup for bundled-Postgres
  installs.
- Cloudflare tunnel ingress as an optional managed ingress mode.
- Docs, public site, generated OpenAPI metadata, Docker image build/push tooling,
  and release smoke tooling aligned to version `0.1.0`.

## Install And Upgrade Scope

v0.1.0 does not ship a one-line installer. The supported install path is the
documented source/Docker workflow in `apps/docs/src/content/docs/install/`.
Operators build or pull the image, run the bundled setup entrypoint once, then
run the dashboard container on `docklands-network` behind the host-level Traefik
container.

There is no previous Docklands release image to upgrade from yet. The release
smoke gates prove fresh install, first owner, deploy, public Traefik ingress,
whole-instance backup, and same-image container replacement/restart behavior.
A previous-version upgrade smoke should be added after v0.1.0 exists as the
baseline image.

## Known v0.1.0 Boundaries

- Docklands is self-hosted software, not a hosted multi-tenant service.
- There is exactly one organization per instance.
- GitLab, Gitea, and Bitbucket deploy through clone/refresh-token flows in this
  release; they do not have signed provider-specific webhooks or pull request
  preview environments yet.
- General-purpose standalone automations are not shipped. Scheduled backups are
  the scheduled task surface in v0.1.0.
- External Postgres disaster recovery is operator-managed. Built-in
  whole-instance backup/restore supports the bundled Postgres service and blocks
  unsupported database modes with operator guidance.
- libSQL and Redis use volume backups rather than logical database dumps.
- Raw published ports are operator-managed exposure points. Docklands does not
  add authentication in front of arbitrary TCP/UDP ports.

## Required Release Evidence

Before tagging `0.1.0`, the release candidate tree must be clean and these gates
must pass:

```sh
bun run release:preflight canary
git push origin canary
bun run release:smoke:dispatch --wait canary
bun run docker:push
```

`release:preflight` verifies release metadata, Docker build/push dry-runs,
frozen install metadata, format/lint, typecheck, Vitest, Base UI scanning,
OpenAPI generation, app/docs/site builds, and a smoke-dispatch dry-run.

`release:smoke:dispatch --wait` dispatches the real-deploy smoke and
host-operator smoke workflows for the pushed ref, then waits for both newly
created workflow runs to finish successfully.

`docker:push` publishes `jason301c/docklands:0.1.0` and
`jason301c/docklands:latest`; it refuses dirty tracked files by default.

## Operator Notes

- Preserve `DOCKLANDS_ENCRYPTION_KEY`; it is required to decrypt stored
  provider credentials, secrets, backup destinations, and related secret-box
  values.
- Preserve `/etc/docklands` for production installs. It contains runtime state,
  Traefik config, and mounted data used by setup and restore flows.
- For external Postgres installs, use your database provider/operator backup
  tooling for database recovery and separately preserve Docklands filesystem
  state plus encryption keys.
- Review published ports, domain DNS, TLS settings, and Cloudflare tunnel state
  before exposing an instance to the internet.
