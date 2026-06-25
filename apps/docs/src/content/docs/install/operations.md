---
title: Operations
description: Migrations, account recovery, secret rotation, backups, and upgrades.
---

Day-two tasks for running a Docklands instance. The commands below assume you can
run the control plane's entrypoints — in production they're bundled as
`dist/*.mjs` and run with `node`; from source they have `bun run` aliases.

## Database migrations

Migrations are applied **automatically on every start** (the production start
command runs `migrate-db` before the server). To run them by hand:

```bash
# from source
bun run migration:run

# in a built container
node -r dotenv/config dist/migrate-db.mjs
```

Schema lives in `apps/docklands/drizzle/`. If you change the schema while
developing, generate a migration with `bun run migration:generate` and commit
the SQL plus the `drizzle/meta` snapshot.

## Recover the owner account

Reset the organization owner's password (prints a new random password):

```bash
# from source
bun run reset-password
# built container
node -r dotenv/config dist/reset-password.mjs
```

Docklands does not use authenticator-app one-time codes. Passwordless
authentication is handled with [passkeys](/access/profile-and-security/), so
there is no separate authenticator reset entrypoint. If you lose your only
passkey, recover the account with `reset-password` above and re-register a
passkey after signing in.

## Back up the control plane itself

Backups you configure inside Docklands cover your **databases and volumes** (see
[Backups](/backups/overview/)). To capture **Docklands' own state** for disaster
recovery, back up three things together:

1. **The PostgreSQL database** behind `DATABASE_URL` (projects, services,
   settings, credentials).
2. **The base directory** `/etc/docklands` (Traefik config, TLS certificates,
   SSH keys, registry data). See [Architecture](/concepts/architecture/)
   for the layout.
3. **The encryption key** `DOCKLANDS_ENCRYPTION_KEY` (or whatever
   `DOCKLANDS_ENCRYPTION_KEY_FILE` points at). Secret material in the database is
   encrypted at rest with this key, so a database dump restored **without** it is
   undecryptable. Keep the key backed up alongside (but stored separately from)
   the dump.

A restore needs all three: the database without the encryption key cannot be
read, and the database without the keys/certs in `/etc/docklands` is incomplete.

:::note[External Postgres]
The built-in whole-instance Docklands backup and `restore-instance` entrypoint
currently support only the bundled `docklands-postgres` service. If
`DATABASE_URL` points at an external PostgreSQL instance, back up and restore
that database with your provider/operator tooling, then restore `/etc/docklands`
and the same `DOCKLANDS_ENCRYPTION_KEY`.
:::

:::caution[Secrets at rest]
Provider tokens, SSH private keys, database credentials, TLS private keys, and
service environment variables are **encrypted at rest with AES-256-GCM** before
being written to the database (see [Configuration → Secrets at
rest](/install/configuration/#secrets-at-rest)). A database dump therefore does
not expose those secrets in the clear — but it is only as protected as
`DOCKLANDS_ENCRYPTION_KEY`. Treat that key, your database dumps, and
`/etc/docklands` backups as secret material and store the key apart from the
dumps.
:::

## Upgrading

While Docklands is pre-release there is no managed upgrade flow. The mechanical
steps are: pull/rebuild the image, then restart the container — migrations run on
start. Because the [deployment queue is in-memory](/concepts/architecture/),
**in-flight and queued deployments are lost on restart**, so upgrade when nothing
critical is mid-deploy, and re-trigger anything that was running.
