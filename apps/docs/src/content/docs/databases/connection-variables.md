---
title: Connection Variables
description: How a managed database projects generated credentials into the services that connect to it.
---

Each managed database knows how to describe itself as a set of environment
variables — a ready-to-use connection URL plus the individual host, name, user,
and password pieces. Docklands calls these **connection variables**. When you
connect a service to a database on the project canvas, Docklands can copy those
variables into the service's environment so your app can reach the database
without you typing credentials by hand.

## What each engine projects

The variables are derived from the engine and the database's stored credentials.
The internal host is always the database's **service name** (its name on the
runtime network); user/password/database values are URL-encoded inside the
connection URL.

| Engine | Variables |
| --- | --- |
| PostgreSQL | `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| MySQL | `DATABASE_URL`, `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` |
| MariaDB | `DATABASE_URL`, `MARIADB_HOST`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD` |
| MongoDB | `MONGO_URL`, `MONGO_HOST`, `MONGO_USER`, `MONGO_PASSWORD` |
| Redis | `REDIS_URL`, `REDIS_HOST`, `REDIS_PASSWORD` |
| libSQL | `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN` |

For example, a PostgreSQL service named `myapp-db` projects:

```sh
DATABASE_URL=postgresql://postgres:s3cret@myapp-db:5432/postgres
POSTGRES_HOST=myapp-db
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=s3cret
```

These are **internal** addresses: the host is the runtime service name and the
port is the container's internal port, reachable only from other services on the
same Docklands network. To reach a database from outside the VM, see
[External access](/databases/external-access/).

## Connecting a service

On the workspace canvas, draw a connection from the **database** to the service
that should consume it. The database is the source; the application or compose
service is the target. When you apply the connection's variables, Docklands
merges the engine's variables into the target service's environment (existing
keys with the same name are updated in place).

:::note
Connection variables flow **from** a managed database **into** an application or
compose service. Only managed-database sources project variables — connecting two
applications together does not generate any.
:::

After the variables are applied, redeploy the target service so it picks up the
new environment.

## Where the credentials come from

The values come straight from the database's stored credentials, so they always
reflect the current password. If you
[change the database password](/databases/managing/#change-the-password), reapply the
connection (or redeploy the target) so connected services pick up the new value —
Docklands does not retroactively rewrite already-applied variables for you.

:::caution
Connection variables embed the database password in plain text in the target
service's environment, including inside `DATABASE_URL`. Treat any service you
connect to a database as holding that secret, and avoid logging its full
environment.
:::
