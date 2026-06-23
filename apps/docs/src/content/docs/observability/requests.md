---
title: Request Analytics
description: Inspect incoming HTTP requests handled by the ingress runtime, built from Traefik access logs.
---

`/dashboard/requests` shows the HTTP requests flowing through the Docklands
ingress runtime — request host, path, method, status code, timing, and more.
The data comes from the **ingress access log** (Traefik's JSON access log), so
this view reflects real traffic to your deployed services.

## Turning request logging on

Request analytics is **off by default**. The access log adds overhead and disk
usage, so you opt in:

1. On `/dashboard/requests`, click **Activate**. This writes an `accessLog`
   block (JSON format) into the ingress runtime's main configuration.
2. **Reload the ingress runtime** so the change takes effect. The page links you
   to `/dashboard/settings/ingress` to do this, and shows a warning until access
   log entries start appearing.

Activating and deactivating requests requires an **admin** (owner/admin) role,
as does reloading ingress.

Until you reload ingress and traffic actually flows, the view shows a "Requests
are not activated" or "no logs yet" state.

## What is captured

Each log line is one HTTP request as recorded by the ingress runtime, including:

- request host, path, method, scheme, and protocol,
- the downstream status code and response/content sizes,
- request and origin durations and retry counts,
- client address and user agent,
- the matched router and backend service.

Requests to the Docklands dashboard itself are filtered out of the analytics so
you see application traffic, not control-plane traffic.

## Using the view

When active, `/dashboard/requests` gives you:

- a **distribution chart** of request volume over time (bucketed hourly), and
- a **requests table** you can page, sort, and filter.

You can filter by **date range** (defaulting to the last three days), search by
request host, and filter by **status class** — informational (1xx), success
(2xx), redirect (3xx), client error (4xx), and server error (5xx). Reading the
request data requires only a signed-in session.

## Log retention and cleanup

The access log is a single file on disk that grows with traffic. Docklands ships
a **log cleanup** job to keep it bounded:

- It runs on a cron schedule you set on the requests page (default: daily at
  midnight, `0 0 * * *`).
- At each run it **truncates the access log to its last 1,000 lines** and signals
  the ingress runtime to reopen its log files.

You can change the schedule or disable cleanup from the requests page;
configuring it requires an admin role.

:::caution
Cleanup keeps only the **most recent 1,000 lines** of the access log. Request
analytics is therefore a **rolling recent window**, not long-term history — once
the file is truncated, older requests are gone. If you have steady traffic and
infrequent cleanup, the log can grow large between runs; if cleanup is frequent,
your visible history is short. There is no archival or external sink for these
logs in the default setup.
:::

:::note
Because the analytics are parsed from the raw access-log file on each query
(filtering, sorting, and paging happen in memory), very large logs make this
view slower. The cleanup job's 1,000-line cap also keeps the parse cheap.
:::
