import type { PgTable } from "drizzle-orm/pg-core";
import {
	custom,
	discord,
	email,
	gotify,
	lark,
	mattermost,
	type notifications,
	ntfy,
	pushover,
	resend,
	slack,
	teams,
	telegram,
} from "@/server/core/db/schema";

/**
 * Registry of the 12 notification providers.
 *
 * Each descriptor encodes everything the generic CRUD path needs to reproduce
 * the original hand-written `create<Provider>Notification` /
 * `update<Provider>Notification` services byte-for-byte:
 *
 * - `table`          the provider sub-table (e.g. `slack`).
 * - `idColumn`       the sub-table primary-key property name (e.g. `slackId`).
 * - `notificationFk` the FK column on `notifications` pointing at the sub-table
 *                    row (e.g. `slackId`).
 * - `subValues`      maps the create/update input to the exact sub-table
 *                    insert/update values (same columns, same defaults, same
 *                    conditional/coalescing quirks as the original service).
 * - `includeServerThreshold` whether the parent `notifications` row carries the
 *                    `serverThreshold` field. Gotify and Ntfy historically
 *                    omitted it on both create and update, so the column keeps
 *                    its DB default on create and is left untouched on update —
 *                    this flag preserves that exactly.
 *
 * The discriminant is the `notificationType` enum value, which is also written
 * into the `notifications` row on create.
 */

export type NotificationType =
	(typeof notifications.$inferInsert)["notificationType"];

interface NotificationDescriptor<TInput = any> {
	/** Provider sub-table. */
	table: PgTable;
	/** Primary-key property on the sub-table. */
	idColumn: string;
	/** FK property on `notifications` referencing the sub-table row. */
	notificationFk: keyof typeof notifications.$inferInsert;
	/** Map create/update input -> sub-table insert/update values. */
	subValues: (input: TInput) => Record<string, unknown>;
	/** Whether the parent notification row carries `serverThreshold`. */
	includeServerThreshold: boolean;
}

export const notificationRegistry: Record<
	NotificationType,
	NotificationDescriptor
> = {
	slack: {
		table: slack,
		idColumn: "slackId",
		notificationFk: "slackId",
		includeServerThreshold: true,
		subValues: (input) => ({
			channel: input.channel,
			webhookUrl: input.webhookUrl,
		}),
	},
	telegram: {
		table: telegram,
		idColumn: "telegramId",
		notificationFk: "telegramId",
		includeServerThreshold: true,
		subValues: (input) => ({
			botToken: input.botToken,
			chatId: input.chatId,
			messageThreadId: input.messageThreadId,
		}),
	},
	discord: {
		table: discord,
		idColumn: "discordId",
		notificationFk: "discordId",
		includeServerThreshold: true,
		subValues: (input) => ({
			webhookUrl: input.webhookUrl,
			decoration: input.decoration,
		}),
	},
	email: {
		table: email,
		idColumn: "emailId",
		notificationFk: "emailId",
		includeServerThreshold: true,
		subValues: (input) => ({
			smtpServer: input.smtpServer,
			smtpPort: input.smtpPort,
			username: input.username,
			password: input.password,
			fromAddress: input.fromAddress,
			toAddresses: input.toAddresses,
		}),
	},
	resend: {
		table: resend,
		idColumn: "resendId",
		notificationFk: "resendId",
		includeServerThreshold: true,
		subValues: (input) => ({
			apiKey: input.apiKey,
			fromAddress: input.fromAddress,
			toAddresses: input.toAddresses,
		}),
	},
	gotify: {
		table: gotify,
		idColumn: "gotifyId",
		notificationFk: "gotifyId",
		// Gotify never wrote serverThreshold onto the notification row.
		includeServerThreshold: false,
		subValues: (input) => ({
			serverUrl: input.serverUrl,
			appToken: input.appToken,
			priority: input.priority,
			decoration: input.decoration,
		}),
	},
	ntfy: {
		table: ntfy,
		idColumn: "ntfyId",
		notificationFk: "ntfyId",
		// Ntfy never wrote serverThreshold onto the notification row.
		includeServerThreshold: false,
		subValues: (input) => ({
			serverUrl: input.serverUrl,
			topic: input.topic,
			// Original service coalesced undefined -> null explicitly.
			accessToken: input.accessToken ?? null,
			priority: input.priority,
		}),
	},
	mattermost: {
		table: mattermost,
		idColumn: "mattermostId",
		notificationFk: "mattermostId",
		includeServerThreshold: true,
		subValues: (input) => ({
			webhookUrl: input.webhookUrl,
			channel: input.channel,
			username: input.username,
		}),
	},
	pushover: {
		table: pushover,
		idColumn: "pushoverId",
		notificationFk: "pushoverId",
		includeServerThreshold: true,
		subValues: (input) => ({
			userKey: input.userKey,
			apiToken: input.apiToken,
			priority: input.priority,
			retry: input.retry,
			expire: input.expire,
		}),
	},
	custom: {
		table: custom,
		idColumn: "customId",
		notificationFk: "customId",
		includeServerThreshold: true,
		subValues: (input) => ({
			endpoint: input.endpoint,
			headers: input.headers,
		}),
	},
	lark: {
		table: lark,
		idColumn: "larkId",
		notificationFk: "larkId",
		includeServerThreshold: true,
		subValues: (input) => ({
			webhookUrl: input.webhookUrl,
		}),
	},
	teams: {
		table: teams,
		idColumn: "teamsId",
		notificationFk: "teamsId",
		includeServerThreshold: true,
		subValues: (input) => ({
			webhookUrl: input.webhookUrl,
		}),
	},
};
