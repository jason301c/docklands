import type { RouterOutputs } from "@/client/api/trpc";
import type { NotificationFormInput } from "./notification-schema";

/** The saved notification (with provider relations) returned by `notification.one`. */
type Notification = NonNullable<RouterOutputs["notification"]["one"]>;

/**
 * Convert the form's `headers` array (`{ key, value }[]`) into the record shape
 * the custom-notification mutations expect, dropping blank keys. Shared by the
 * submit and test dispatchers so the reduce lives in exactly one place.
 */
export const headersArrayToRecord = (
	headers: { key: string; value: string }[] | undefined,
): Record<string, string> | undefined => {
	if (!headers || headers.length === 0) return undefined;
	const record: Record<string, string> = {};
	for (const { key, value } of headers) {
		if (key.trim()) record[key] = value;
	}
	return record;
};

/**
 * The shared base fields every provider's `form.reset` writes back from the
 * saved notification's parent row.
 */
const baseResetFields = (notification: Notification) => ({
	name: notification.name,
	appDeploy: notification.appDeploy,
	appBuildError: notification.appBuildError,
	databaseBackup: notification.databaseBackup,
	docklandsBackup: notification.docklandsBackup,
	volumeBackup: notification.volumeBackup,
	docklandsRestart: notification.docklandsRestart,
	dockerCleanup: notification.dockerCleanup,
});

/**
 * Per-provider reset extensions. Each returns the provider-specific fields its
 * branch originally wrote (reading from the matching relation on the saved
 * notification), coalescing optionals exactly as before. The discriminant
 * `type` and the shared base fields are added by `buildResetValues`.
 */
const providerResetFields: Record<
	Notification["notificationType"],
	(notification: Notification) => Record<string, unknown>
> = {
	slack: (n) => ({
		webhookUrl: n.slack?.webhookUrl,
		channel: n.slack?.channel || "",
	}),
	telegram: (n) => ({
		botToken: n.telegram?.botToken,
		messageThreadId: n.telegram?.messageThreadId || "",
		chatId: n.telegram?.chatId,
	}),
	discord: (n) => ({
		webhookUrl: n.discord?.webhookUrl,
		decoration: n.discord?.decoration ?? undefined,
	}),
	email: (n) => ({
		smtpServer: n.email?.smtpServer,
		smtpPort: n.email?.smtpPort,
		username: n.email?.username,
		password: n.email?.password,
		toAddresses: n.email?.toAddresses,
		fromAddress: n.email?.fromAddress,
	}),
	resend: (n) => ({
		apiKey: n.resend?.apiKey,
		toAddresses: n.resend?.toAddresses,
		fromAddress: n.resend?.fromAddress,
	}),
	gotify: (n) => ({
		appToken: n.gotify?.appToken,
		decoration: n.gotify?.decoration ?? undefined,
		priority: n.gotify?.priority,
		serverUrl: n.gotify?.serverUrl,
	}),
	ntfy: (n) => ({
		accessToken: n.ntfy?.accessToken || "",
		topic: n.ntfy?.topic,
		priority: n.ntfy?.priority,
		serverUrl: n.ntfy?.serverUrl,
	}),
	mattermost: (n) => ({
		webhookUrl: n.mattermost?.webhookUrl,
		channel: n.mattermost?.channel || "",
		username: n.mattermost?.username || "",
	}),
	lark: (n) => ({
		webhookUrl: n.lark?.webhookUrl,
	}),
	teams: (n) => ({
		webhookUrl: n.teams?.webhookUrl,
	}),
	custom: (n) => ({
		endpoint: n.custom?.endpoint || "",
		headers: n.custom?.headers
			? Object.entries(n.custom.headers).map(([key, value]) => ({
					key,
					value,
				}))
			: [],
	}),
	pushover: (n) => ({
		userKey: n.pushover?.userKey,
		apiToken: n.pushover?.apiToken,
		priority: n.pushover?.priority,
		retry: n.pushover?.retry ?? undefined,
		expire: n.pushover?.expire ?? undefined,
	}),
};

/**
 * Build the `form.reset` values for a saved notification: the discriminant,
 * the shared base fields, and the provider-specific fields. Replaces the
 * original 12-arm `form.reset` if/else with one derived value object.
 */
export const buildResetValues = (
	notification: Notification,
): NotificationFormInput => {
	const type = notification.notificationType;
	return {
		type,
		...baseResetFields(notification),
		...providerResetFields[type](notification),
	} as NotificationFormInput;
};
