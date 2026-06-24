import { z } from "zod";

/**
 * Shared base fields carried by every notification provider's form. These map
 * onto the parent `notifications` row (the per-provider credentials live in the
 * discriminated members below). `serverThreshold` is part of the base schema for
 * the UI toggle, but note that two providers (gotify, ntfy) never persist it —
 * see `notificationsMap[type].serverThreshold` and the backend registry.
 */
export const notificationBaseSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	appDeploy: z.boolean().default(false),
	appBuildError: z.boolean().default(false),
	databaseBackup: z.boolean().default(false),
	docklandsBackup: z.boolean().default(false),
	volumeBackup: z.boolean().default(false),
	docklandsRestart: z.boolean().default(false),
	dockerCleanup: z.boolean().default(false),
	serverThreshold: z.boolean().default(false),
});

/**
 * The full notification form schema: a discriminated union (by `type`) across
 * all 12 providers, each merging the shared base fields with its own
 * credential/config fields. The resolver transforms the form's input values
 * (defaulted booleans optional pre-parse) into `NotificationSchema`.
 */
export const notificationSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("slack"),
			webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
			channel: z.string(),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("telegram"),
			botToken: z.string().min(1, { message: "Bot Token is required" }),
			chatId: z.string().min(1, { message: "Chat ID is required" }),
			messageThreadId: z.string().optional(),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("discord"),
			webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
			decoration: z.boolean().default(true),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("email"),
			smtpServer: z.string().min(1, { message: "SMTP Server is required" }),
			smtpPort: z.number().min(1, { message: "SMTP Port is required" }),
			username: z.string().min(1, { message: "Username is required" }),
			password: z.string().min(1, { message: "Password is required" }),
			fromAddress: z.string().min(1, { message: "From Address is required" }),
			toAddresses: z
				.array(
					z.string().min(1, { message: "Email is required" }).email({
						message: "Email is invalid",
					}),
				)
				.min(1, { message: "At least one email is required" }),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("resend"),
			apiKey: z.string().min(1, { message: "API Key is required" }),
			fromAddress: z
				.string()
				.min(1, { message: "From Address is required" })
				.email({ message: "Email is invalid" }),
			toAddresses: z
				.array(
					z.string().min(1, { message: "Email is required" }).email({
						message: "Email is invalid",
					}),
				)
				.min(1, { message: "At least one email is required" }),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("gotify"),
			serverUrl: z.string().min(1, { message: "Server URL is required" }),
			appToken: z.string().min(1, { message: "App Token is required" }),
			priority: z.number().min(1).max(10).default(5),
			decoration: z.boolean().default(true),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("ntfy"),
			serverUrl: z.string().min(1, { message: "Server URL is required" }),
			topic: z.string().min(1, { message: "Topic is required" }),
			accessToken: z.string().optional(),
			priority: z.number().min(1).max(5).default(3),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("mattermost"),
			webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
			channel: z.string().optional(),
			username: z.string().optional(),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("pushover"),
			userKey: z.string().min(1, { message: "User Key is required" }),
			apiToken: z.string().min(1, { message: "API Token is required" }),
			priority: z.number().min(-2).max(2).default(0),
			retry: z.number().min(30).nullish(),
			expire: z.number().min(1).max(10800).nullish(),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("custom"),
			endpoint: z.string().min(1, { message: "Endpoint URL is required" }),
			headers: z
				.array(
					z.object({
						key: z.string(),
						value: z.string(),
					}),
				)
				.optional()
				.default([]),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("lark"),
			webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
		})
		.merge(notificationBaseSchema),
	z
		.object({
			type: z.literal("teams"),
			webhookUrl: z.string().min(1, { message: "Webhook URL is required" }),
		})
		.merge(notificationBaseSchema),
]);

export type NotificationSchema = z.infer<typeof notificationSchema>;

/**
 * The form's field values are the schema *input* (defaulted booleans are
 * optional pre-parse); the resolver transforms them into `NotificationSchema`.
 * The extracted provider field-sets type their `control` against these so it
 * matches `form.control` exactly (see `provider-fields/types.ts`).
 */
export type NotificationFormInput = z.input<typeof notificationSchema>;

/** The provider discriminant (`"slack" | "telegram" | ...`). */
export type NotificationType = NotificationSchema["type"];
