# Replica — the provisioning blueprint

This directory is the single source of truth for "a Docklands server." Local
dev, setup-script verification, and release all stand up the *same* host shape
from here, so "works in dev" and "works for a user" cannot diverge.

- `lima.yaml` — the declarative blueprint: Ubuntu 24.04 + real Linux Docker
  Engine + Node 24 + Bun, with the working tree mounted at `/workspace` and
  ports forwarded to the host.
- `replica.sh` — the driver behind `bun run replica:up|ssh|reset|down`.

## Why a VM (and not Docker Desktop)

Docklands is welded to its host: it inits Swarm, mounts the Docker socket into
Traefik, bind-mounts app source into containers, and writes `/etc/docklands`.
A faithful environment therefore runs the **whole stack on a real Linux host**.
The VM is that host; your laptop only runs the editor and the browser, bridged
over SSH. macOS Docker Desktop is itself a Linux VM with quirks Docklands would
trip over, so we use a Lima VM you fully control and can reset.

## Quick start

```sh
bun run replica:up            # boot a replica (host arch; --arch arm64|amd64 to pin)
bun run replica:ssh           # shell in; prints Remote-SSH + port-forward details
# inside the VM:
cd /workspace && bun install && bun run dev   # http://localhost:3000 from your Mac's Chrome
bun run replica:reset         # wipe back to a clean base install
bun run replica:down          # stop (keeps disk)
```

Edit from your laptop with VS Code / Cursor **Remote-SSH**: run
`limactl show-ssh --format config docklands-replica`, add it to your editor's SSH
config, and connect to host `lima-docklands-replica`. Files live in `/workspace`;
the runtime, Docker, and Swarm stay in the VM.

## Hosting replicas on a dedicated box (e.g. a Mac Mini)

A "replica host" is any machine that can run Lima. To offload heavy replicas to a
spare box, open a Remote-SSH session to that box and run the same
`bun run replica:*` commands there. The box becomes a shared replica host; the
commands and the blueprint are identical.

## Architecture note

On an Apple Silicon host the VM is arm64 by default. Most cloud servers are
amd64, so release verification always runs on amd64 in CI. To reproduce an amd64
deploy locally, pass `--arch amd64` (slower, emulated on Apple Silicon).
