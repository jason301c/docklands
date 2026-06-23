---
title: Environment Variables & Secrets
description: Set runtime environment variables, reference shared workspace and environment values, and pass build-time arguments and secrets.
---

The **Environment** tab is where you set the variables your application sees at
runtime, plus — for Dockerfile builds — build-time arguments and secrets. You
need write access to environment variables to save changes.

## Runtime environment variables

The **Environment Settings** field is a plain text area of `KEY=VALUE` pairs, one
per line:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://app:secret@db:5432/app
```

These are injected into the container as environment variables when the service is
created. Saving shows an "unsaved changes" hint until you click **Save**; you can
also press `Ctrl+S` / `Cmd+S`.

Changes take effect on the next deploy (or a **Reload**), not the moment you save.

## Referencing shared values

Workspaces and environments have their own shared variable stores, and an
application can pull values from them with a `${{ ... }}` reference instead of
hard-coding the value. Three reference forms are supported:

- `${{workspace.NAME}}` — pulls `NAME` from the workspace-level variables.
- `${{environment.NAME}}` — pulls `NAME` from the current environment's
  variables.
- `${{NAME}}` — pulls `NAME` from this same application's variables
  (self-reference / composition).

For example:

```bash
DATABASE_URL=${{workspace.DATABASE_URL}}
API_BASE=https://${{environment.PUBLIC_HOST}}
INTERNAL_URL=${{API_BASE}}/internal
```

References are resolved at deploy time. If a referenced name does not exist in the
matching store, the deploy fails with a clear error naming the missing variable,
so a typo surfaces immediately rather than shipping an empty value.

:::caution
The old `${{project.NAME}}` namespace is no longer supported. Docklands rejects it
with an error telling you to use `${{workspace.NAME}}` instead. Update any
references you carried over.
:::

:::tip
Connecting services on the workspace canvas can generate connection variables (for
example a database URL) into the shared stores. Reference those with
`${{workspace.…}}` / `${{environment.…}}` instead of copying credentials into each
app.
:::

## Build-time arguments and secrets (Dockerfile only)

When the [build type](/applications/builds/) is **Dockerfile**, three extra
controls appear:

- **Build-time Arguments** — `KEY=VALUE` lines passed to `docker build` as
  `--build-arg`. Use them for non-sensitive build configuration (a registry
  scope, a feature flag, a version).
- **Build-time Secrets** — `KEY=VALUE` lines exposed to the build via Docker's
  BuildKit secret mechanism, so they are available during the build without being
  baked into image layers. Use them for things like a private package token.
- **Create Environment File** — when enabled, Docklands writes an `.env` file next
  to your Dockerfile during the build. Enabled by default.

These controls only apply to Dockerfile builds; other build types receive your
runtime environment variables but do not take separate build args/secrets.

:::caution
"Build-time secrets" reduce exposure compared to plain build args, but treat build
logs as sensitive. Avoid `echo`-ing secret values in your Dockerfile, and prefer
build secrets over build args for anything you would not want printed. For values
needed only at runtime, use runtime environment variables, not build args.
:::

:::note
Static builds intentionally do **not** write an `.env` file into the served
output, to avoid publishing your variables as a downloadable file. Keep secrets
out of anything that ends up in a static, publicly served directory.
:::
