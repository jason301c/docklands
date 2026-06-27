# Verify — one model for setup/install verification

`verify:*` is the single harness that exercises the install/setup paths most
likely to break a real user. It replaces the old smoke zoo (`docker:smoke*`,
`release:smoke:host`, the host-operator and real-deploy workflows) with one set
of verbs and one set of proven assertions that run identically locally and in CI.

- `lib.sh` — the substrate-agnostic assertions (readiness, Swarm/network,
  first/existing-owner bootstrap, ingress mode, deploy + Traefik routing,
  whole-instance backup).
- `verify.sh` — the orchestrator: brings up a substrate and runs the verbs.

## Substrates

- `--target sandbox` (default) — a self-contained Docker-in-Docker sandbox
  (throwaway Postgres + app container + inner Swarm). Portable: runs on any
  laptop or CI runner with Docker, **no VM required**. This is the CI path.
- `--target host` — assert against an already-running instance on the current
  host's Docker daemon (Swarm/Traefik already up via the image's
  `setup-instance`). This is what runs **inside a replica VM** or on a disposable
  host, and it exercises the real port-80 Traefik route.

## Verbs

```sh
bun run verify:install   # readiness + Swarm + docklands-network
bun run verify:deploy    # + first-owner bootstrap + deploy a service + ingress
bun run verify:upgrade   # bootstrap, replace the container with the new image, data survives
bun run verify:backup    # + whole-instance backup to object storage + restore listing
bun run verify:worker    # assert a second SSH-reachable Docker host (remote-worker precondition)
bun run verify           # install + deploy + upgrade + backup (worker if configured)
```

Pass flags after `--`, e.g. `bun run verify:deploy -- --image docklands:0.1.0`,
or `bun run verify -- --target host` from inside a replica.

## verify:worker

Runtime workers reach Docker over SSH, so `verify:worker` proves that exact
precondition: an SSH-reachable Docker daemon on a second host. It needs
`DOCKLANDS_VERIFY_WORKER_HOST` and `DOCKLANDS_VERIFY_WORKER_SSH_KEY` (optionally
`DOCKLANDS_VERIFY_WORKER_USER`/`DOCKLANDS_VERIFY_WORKER_PORT`). It never silently
skips — without a worker host it fails with guidance. The full UI-driven join is
exercised by provisioning a second replica VM. Because it needs a second host,
`verify` (all) includes it only when one is configured, and loudly notes when it
is skipped.

## Key environment overrides

`DOCKLANDS_VERIFY_IMAGE`, `DOCKLANDS_VERIFY_TARGET`, `DOCKLANDS_VERIFY_TIMEOUT_SECONDS`,
`DOCKLANDS_VERIFY_BASE_URL`, `DOCKLANDS_VERIFY_TRAEFIK_URL`,
`DOCKLANDS_VERIFY_S3_ENDPOINT` (point backup at an external S3 instead of the
bundled MinIO), and the `DOCKLANDS_VERIFY_*_IMAGE` pins for dind/postgres/minio/mc.
