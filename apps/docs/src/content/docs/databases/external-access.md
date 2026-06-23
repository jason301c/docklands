---
title: External Access
description: Expose a managed database on a host port so you can reach it from outside the VM.
---

By default a managed database is reachable only by other services on the
Docklands runtime network, using its [connection variables](/databases/connection-variables/).
To connect from outside the VM — a local client, an admin tool, another machine —
you publish an **external port** that maps the host to the database's container
port.

## Set an external port

Open the database and find the **External Credentials** card. Enter an
**External Port (Internet)** in the range `0`–`65535` and save. Docklands:

1. Checks the port is not already in use on the target runtime worker.
2. Updates the database and redeploys it with the new published port.

Once a port is set, the card shows the full **External Host** connection URL,
built from the runtime worker's IP address (or your configured ingress IP) and
the credentials — for example:

```sh
postgresql://postgres:s3cret@203.0.113.10:5433/postgres
```

:::caution
Publishing an external port exposes the database to anything that can reach that
host and port. Make sure the database has a strong password, restrict access at
your firewall or security group, and only expose what you need. Anyone who can
reach the port can attempt to authenticate.
:::

### Port conflicts

If the port you choose is already bound by another container, the save fails with
a conflict error naming the container using it. Pick a different port.

:::note
The conflict check looks at containers on the selected runtime worker. A port can
still collide with a non-container process on the host (or with a port a future
deployment will claim), so the published port may fail at the Docker layer even
after the check passes. If a deploy fails to bind, choose another port.
:::

## libSQL has extra ports

libSQL listens on three internal ports: HTTP (`8080`), gRPC (`5001`), and admin
(`5000`). The **External Port** field publishes the HTTP port. The gRPC and admin
external ports are taken from the database's libSQL configuration and shown
read-only on the card when set.

## Set an IP first

The external connection URL needs an IP to point at. If you have not configured
one, the card warns you and links to your **Runtime network settings** at
`/dashboard/settings/ingress`. When the database is pinned to a specific runtime
worker, that worker's IP is used instead.

## Removing external access

Clear the external port and save to stop publishing the database. It then redeploys
without the host port mapping and is once again reachable only over the internal
network.
