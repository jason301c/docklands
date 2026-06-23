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

Disable two-factor on the owner account (if you're locked out by a lost 2FA
device):

```bash
bun run reset-2fa
# or: node -r dotenv/config dist/reset-2fa.mjs
```

## Rotate the auth secret

If you need to change `BETTER_AUTH_SECRET`, re-encrypt existing data with the
migration entrypoint, supplying the old and new secrets:

```bash
OLD_SECRET="<current>" NEW_SECRET="<new>" \
  node -r dotenv/config dist/migrate-auth-secret.mjs
```

Then update `BETTER_AUTH_SECRET` (or `BETTER_AUTH_SECRET_FILE`) to the new value.

## Back up the control plane itself

Backups you configure inside Docklands cover your **databases and volumes** (see
[Backups](/backups/overview/)). To capture **Docklands' own state** for disaster
recovery, back up two things together:

1. **The PostgreSQL database** behind `DATABASE_URL` (projects, services,
   settings, credentials).
2. **The base directory** `/etc/docklands` (Traefik config, TLS certificates,
   SSH keys, registry data, schedules). See [Architecture](/concepts/architecture/)
   for the layout.

A restore needs both: the database without the keys/certs, or vice versa, is
incomplete.

:::caution[Secrets at rest]
Provider tokens, SSH private keys, database credentials, and TLS private keys are
stored unencrypted in the database and on disk. Protect your database dumps and
`/etc/docklands` backups accordingly — treat them as secret material.
:::

## Upgrading

While Docklands is pre-release there is no managed upgrade flow. The mechanical
steps are: pull/rebuild the image, then restart the container — migrations run on
start. Because the [deployment queue is in-memory](/concepts/architecture/),
**in-flight and queued deployments are lost on restart**, so upgrade when nothing
critical is mid-deploy, and re-trigger anything that was running.
