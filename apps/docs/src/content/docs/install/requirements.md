---
title: Requirements
description: What you need to run Docklands on your own machine.
---

Docklands is a deployment control plane, so its host behaves more like a
disposable Linux box than a typical web app server — it initializes Docker
Swarm, creates networks and Swarm services, binds common ports, and writes to
the filesystem.

## Host

- **A Linux VM you are comfortable mutating.** Docklands will initialize Docker
  Swarm, create the `docklands-network` overlay, run Traefik and Postgres as
  Swarm services, and bind ports. Don't point it at a daemon holding containers
  or port bindings you care about.
- **Docker Engine** with Swarm available. The control plane talks to the Docker
  socket (or a daemon you specify via `DOCKLANDS_DOCKER_HOST` / `DOCKER_HOST`).
- **Root / Docker access.** Managing Swarm services and the socket needs
  appropriate privileges.

## Ports

Expect these to be in play. Conflicts here are the most common setup problem:

| Port | Used for |
|---|---|
| `80`, `443` | Traefik ingress (HTTP/HTTPS) |
| `3000` | The Docklands dashboard (`PORT`, configurable) |
| `5432` | PostgreSQL (the control-plane database) |

Application services you deploy may bind additional ports.

## Resources

There is no hard published minimum yet (Docklands is pre-release), but the host
runs the control plane, PostgreSQL, Traefik, and every workload you deploy plus
their builds. Builds are the spike — size for your heaviest build, and consider
offloading builds to a [remote runtime worker](/runtime/runtime-workers/) if the
control-plane host is small.

## For local development

To run from source (see [Local development](/getting-started/)):

- **Node `>=24.4.0 <26`** — pin it with the repo `.nvmrc` (`24.4.0`) via a
  version manager like [fnm](https://github.com/Schniz/fnm). Avoid Homebrew's
  rolling `node`, which drifts past the supported range.
- **Bun `>=1.3.14`** — the package manager and task runner.
- A reachable **PostgreSQL** for light (UI) work; a mutable **Docker Engine** for
  full deployment flows.
