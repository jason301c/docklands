---
title: Notifications
description: Send deploy, build, backup, cleanup, and restart notifications to Slack, Discord, Telegram, email, and other providers, and choose which events trigger them.
---

Notifications let Docklands tell you when something happens — a build succeeds or
fails, a backup runs, Docker cleanup runs, or the control plane restarts. Each
notification you create pairs **one provider** (where the message goes) with a
set of **event toggles** (which events send a message).

Manage notifications at **Settings → Notifications**
(`/dashboard/settings/notifications`). Notifications are organization-wide.

## Providers

Docklands ships with these notification providers. Each stores its own
connection details:

| Provider | What you provide |
| --- | --- |
| **Slack** | Incoming webhook URL, optional channel |
| **Discord** | Webhook URL, optional decoration toggle |
| **Telegram** | Bot token, chat ID, optional message thread ID |
| **Microsoft Teams** | Incoming webhook URL |
| **Mattermost** | Webhook URL, optional channel and username |
| **Lark** | Webhook URL |
| **Gotify** | Server URL, app token, priority |
| **ntfy** | Server URL, topic, optional access token, priority |
| **Pushover** | User key, API token, priority (and retry/expire for emergency priority) |
| **Email (SMTP)** | SMTP host, port, username, password, from address, one or more recipients |
| **Resend** | Resend API key, from address, one or more recipients |
| **Custom** | An HTTP endpoint and optional headers; Docklands POSTs a JSON payload |

The **Custom** provider POSTs a JSON body describing the event to any endpoint
you choose, so you can wire Docklands into a webhook receiver, an automation
platform, or your own service.

## Events

When you create or edit a notification you turn on the events that should send a
message through that provider. The available events are:

| Event toggle | Fires when |
| --- | --- |
| **App Deploy** | An application or Compose service builds successfully |
| **App Build Error** | An application or Compose build fails |
| **Database Backup** | A database backup completes (success or failure) |
| **Volume Backup** | A volume backup completes |
| **Docklands Backup** | A backup of the Docklands control plane itself runs |
| **Runtime Cleanup** | Scheduled Docker/runtime cleanup runs |
| **Docklands Restart** | The Docklands control plane starts up |

A single notification can subscribe to any combination of events. You can also
create several notifications for the same provider — for example, one Slack
channel for deploys and a different one for backups.

:::note
The **App Deploy** event sends on a successful build/deploy; build failures are a
separate **App Build Error** event. Turn on both if you want to hear about every
deploy outcome.
:::

:::caution
The **Docklands Restart** notification is sent once when the control plane boots.
Because it fires during startup before any user is in context, it is delivered to
every matching notification in the instance rather than being scoped per request.
On a single-owner instance this is the expected behavior.
:::

## Create a notification

1. Go to **Settings → Notifications** and start a new notification.
2. Pick the **provider** and fill in its connection fields.
3. Use the provider's **Test** button to send a `Hi, From Docklands` message and
   confirm the connection works.
4. Enable the **events** that should notify through this provider.
5. Save.

### Testing

Every provider has a test action that sends a sample message immediately using
the details currently in the form, without saving. If the test fails, Docklands
surfaces the error from the provider (for example an invalid webhook URL or
rejected SMTP login) so you can correct it before saving.

## Editing and removing

Editing a notification lets you change the provider details and the event
toggles. Removing a notification deletes it and its stored connection details;
events that targeted it stop being delivered there.

## Secret handling

Provider secrets — webhook URLs, bot tokens, SMTP passwords, API keys, access
tokens — are stored in Docklands' PostgreSQL database. SMTP notifications connect
with the username and password you supply; transport security depends on your
SMTP server and the host/port you configure. Treat database access as access to
these secrets, and prefer scoped/app-specific tokens (for example a dedicated
incoming webhook or a send-only Resend key) over broad credentials.
