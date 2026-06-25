import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { headersArrayToRecord } from "./notification-reset";
import type {
	NotificationSchema,
	NotificationType,
} from "./notification-schema";

/**
 * Narrow a `NotificationSchema` union value to a single provider member, so each
 * dispatcher reads its own fields without re-narrowing at every property.
 */
type ForType<T extends NotificationType> = Extract<
	NotificationSchema,
	{ type: T }
>;

interface UseNotificationMutationsArgs {
	/** Present when editing; selects update-vs-create and supplies the FK ids. */
	notificationId?: string;
	/** Saved notification (for the provider sub-table ids on update). */
	notification: { [k: string]: unknown } | undefined | null;
	/** Runs after a successful create/update (reset form, close dialog, …). */
	onSaved: () => void | Promise<void>;
}

/**
 * Owns the notification create/update/test mutations and exposes registry-keyed
 * dispatchers so `HandleNotifications` never branches per provider.
 *
 * - `submitDispatch[type](data)` builds the exact create/update payload for the
 *   provider and fires the matching mutation. Create/update share one
 *   `crudMutationOptions` config (toast + invalidate + `onSaved`), so the submit
 *   handler is just `submitDispatch[data.type](data)`.
 * - `testDispatch[type](data)` fires the matching `test*Connection` mutation.
 * - `activeMutation[type]` is the live create/update mutation for inline error
 *   display; `isTesting` is the combined test-loading flag for the test button.
 *
 * The deliberate per-provider quirks are preserved: mattermost coerces empty
 * channel/username to `undefined`; telegram/ntfy coerce optional tokens to `""`;
 * custom flattens headers to a record; pushover only sends retry/expire for
 * emergency priority (2).
 */
export const useNotificationMutations = ({
	notificationId,
	notification,
	onSaved,
}: UseNotificationMutationsArgs) => {
	const utils = api.useUtils();

	// Shared success/error handling for every create/update mutation: toast,
	// invalidate the lists (+ the edited record), then run `onSaved`. The inline
	// `activeMutation.isError` block still surfaces the detailed message.
	const writeOptions = (errorMessage: string) =>
		crudMutationOptions({
			successMessage: notificationId
				? "Notification Updated"
				: "Notification Created",
			errorMessage,
			loggerScope: "notifications",
			invalidate: async () => {
				await utils.notification.all.invalidate();
				if (notificationId) {
					await utils.notification.one.invalidate({ notificationId });
				}
			},
			onSuccess: () => onSaved(),
		});

	const createOptions = writeOptions("Error creating a notification");
	const updateOptions = writeOptions("Error updating a notification");

	// Call every create AND update hook unconditionally (rules-of-hooks), then
	// select with `notificationId`. The ternary widens each `*Mutation` to the
	// create|update union so `mutateAsync` accepts either provider payload.
	const createSlack = api.notification.createSlack.useMutation(createOptions);
	const updateSlack = api.notification.updateSlack.useMutation(updateOptions);
	const createTelegram =
		api.notification.createTelegram.useMutation(createOptions);
	const updateTelegram =
		api.notification.updateTelegram.useMutation(updateOptions);
	const createDiscord =
		api.notification.createDiscord.useMutation(createOptions);
	const updateDiscord =
		api.notification.updateDiscord.useMutation(updateOptions);
	const createEmail = api.notification.createEmail.useMutation(createOptions);
	const updateEmail = api.notification.updateEmail.useMutation(updateOptions);
	const createResend = api.notification.createResend.useMutation(createOptions);
	const updateResend = api.notification.updateResend.useMutation(updateOptions);
	const createGotify = api.notification.createGotify.useMutation(createOptions);
	const updateGotify = api.notification.updateGotify.useMutation(updateOptions);
	const createNtfy = api.notification.createNtfy.useMutation(createOptions);
	const updateNtfy = api.notification.updateNtfy.useMutation(updateOptions);
	const createMattermost =
		api.notification.createMattermost.useMutation(createOptions);
	const updateMattermost =
		api.notification.updateMattermost.useMutation(updateOptions);
	const createLark = api.notification.createLark.useMutation(createOptions);
	const updateLark = api.notification.updateLark.useMutation(updateOptions);
	const createTeams = api.notification.createTeams.useMutation(createOptions);
	const updateTeams = api.notification.updateTeams.useMutation(updateOptions);
	const createCustom = api.notification.createCustom.useMutation(createOptions);
	const updateCustom = api.notification.updateCustom.useMutation(updateOptions);
	const createPushover =
		api.notification.createPushover.useMutation(createOptions);
	const updatePushover =
		api.notification.updatePushover.useMutation(updateOptions);

	const slackMutation = notificationId ? updateSlack : createSlack;
	const telegramMutation = notificationId ? updateTelegram : createTelegram;
	const discordMutation = notificationId ? updateDiscord : createDiscord;
	const emailMutation = notificationId ? updateEmail : createEmail;
	const resendMutation = notificationId ? updateResend : createResend;
	const gotifyMutation = notificationId ? updateGotify : createGotify;
	const ntfyMutation = notificationId ? updateNtfy : createNtfy;
	const mattermostMutation = notificationId
		? updateMattermost
		: createMattermost;
	const larkMutation = notificationId ? updateLark : createLark;
	const teamsMutation = notificationId ? updateTeams : createTeams;
	const customMutation = notificationId ? updateCustom : createCustom;
	const pushoverMutation = notificationId ? updatePushover : createPushover;

	const activeMutation = {
		slack: slackMutation,
		telegram: telegramMutation,
		discord: discordMutation,
		email: emailMutation,
		resend: resendMutation,
		gotify: gotifyMutation,
		ntfy: ntfyMutation,
		mattermost: mattermostMutation,
		lark: larkMutation,
		teams: teamsMutation,
		custom: customMutation,
		pushover: pushoverMutation,
	} satisfies Record<NotificationType, unknown>;

	const id = notificationId || "";
	const subId = (key: string) => (notification?.[key] as string) || "";

	const submitDispatch: Record<
		NotificationType,
		(data: NotificationSchema) => Promise<unknown>
	> = {
		slack: (data) => {
			const d = data as ForType<"slack">;
			return slackMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				webhookUrl: d.webhookUrl,
				channel: d.channel,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				slackId: subId("slackId"),
				notificationId: id,
			});
		},
		telegram: (data) => {
			const d = data as ForType<"telegram">;
			return telegramMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				botToken: d.botToken,
				messageThreadId: d.messageThreadId || "",
				chatId: d.chatId,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				telegramId: subId("telegramId"),
			});
		},
		discord: (data) => {
			const d = data as ForType<"discord">;
			return discordMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				webhookUrl: d.webhookUrl,
				decoration: d.decoration,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				discordId: subId("discordId"),
			});
		},
		email: (data) => {
			const d = data as ForType<"email">;
			return emailMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				smtpServer: d.smtpServer,
				smtpPort: d.smtpPort,
				username: d.username,
				password: d.password,
				fromAddress: d.fromAddress,
				toAddresses: d.toAddresses,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				emailId: subId("emailId"),
			});
		},
		resend: (data) => {
			const d = data as ForType<"resend">;
			return resendMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				apiKey: d.apiKey,
				fromAddress: d.fromAddress,
				toAddresses: d.toAddresses,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				resendId: subId("resendId"),
			});
		},
		gotify: (data) => {
			const d = data as ForType<"gotify">;
			return gotifyMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				serverUrl: d.serverUrl,
				appToken: d.appToken,
				priority: d.priority,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				decoration: d.decoration,
				notificationId: id,
				gotifyId: subId("gotifyId"),
			});
		},
		ntfy: (data) => {
			const d = data as ForType<"ntfy">;
			return ntfyMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				serverUrl: d.serverUrl,
				accessToken: d.accessToken || "",
				topic: d.topic,
				priority: d.priority,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				ntfyId: subId("ntfyId"),
			});
		},
		mattermost: (data) => {
			const d = data as ForType<"mattermost">;
			return mattermostMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				webhookUrl: d.webhookUrl,
				channel: d.channel || undefined,
				username: d.username || undefined,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				mattermostId: subId("mattermostId"),
			});
		},
		lark: (data) => {
			const d = data as ForType<"lark">;
			return larkMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				webhookUrl: d.webhookUrl,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				larkId: subId("larkId"),
			});
		},
		teams: (data) => {
			const d = data as ForType<"teams">;
			return teamsMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				webhookUrl: d.webhookUrl,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				teamsId: subId("teamsId"),
			});
		},
		custom: (data) => {
			const d = data as ForType<"custom">;
			return customMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				endpoint: d.endpoint,
				headers: headersArrayToRecord(d.headers),
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				customId: subId("customId"),
			});
		},
		pushover: (data) => {
			const d = data as ForType<"pushover">;
			return pushoverMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				userKey: d.userKey,
				apiToken: d.apiToken,
				priority: d.priority,
				retry: d.priority === 2 ? d.retry : undefined,
				expire: d.priority === 2 ? d.expire : undefined,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				notificationId: id,
				pushoverId: subId("pushoverId"),
			});
		},
	};

	// Test mutations stay as hooks; the dispatch that picks which to fire is a
	// registry, not a 12-arm conditional.
	const testSlack = api.notification.testSlackConnection.useMutation();
	const testTelegram = api.notification.testTelegramConnection.useMutation();
	const testDiscord = api.notification.testDiscordConnection.useMutation();
	const testEmail = api.notification.testEmailConnection.useMutation();
	const testResend = api.notification.testResendConnection.useMutation();
	const testGotify = api.notification.testGotifyConnection.useMutation();
	const testNtfy = api.notification.testNtfyConnection.useMutation();
	const testMattermost =
		api.notification.testMattermostConnection.useMutation();
	const testLark = api.notification.testLarkConnection.useMutation();
	const testTeams = api.notification.testTeamsConnection.useMutation();
	const testCustom = api.notification.testCustomConnection.useMutation();
	const testPushover = api.notification.testPushoverConnection.useMutation();

	const testDispatch: Record<
		NotificationType,
		(data: NotificationSchema) => Promise<unknown>
	> = {
		slack: (data) => {
			const d = data as ForType<"slack">;
			return testSlack.mutateAsync({
				webhookUrl: d.webhookUrl,
				channel: d.channel,
			});
		},
		telegram: (data) => {
			const d = data as ForType<"telegram">;
			return testTelegram.mutateAsync({
				botToken: d.botToken,
				chatId: d.chatId,
				messageThreadId: d.messageThreadId || "",
			});
		},
		discord: (data) => {
			const d = data as ForType<"discord">;
			return testDiscord.mutateAsync({
				webhookUrl: d.webhookUrl,
				decoration: d.decoration,
			});
		},
		email: (data) => {
			const d = data as ForType<"email">;
			return testEmail.mutateAsync({
				smtpServer: d.smtpServer,
				smtpPort: d.smtpPort,
				username: d.username,
				password: d.password,
				fromAddress: d.fromAddress,
				toAddresses: d.toAddresses,
			});
		},
		resend: (data) => {
			const d = data as ForType<"resend">;
			return testResend.mutateAsync({
				apiKey: d.apiKey,
				fromAddress: d.fromAddress,
				toAddresses: d.toAddresses,
			});
		},
		gotify: (data) => {
			const d = data as ForType<"gotify">;
			return testGotify.mutateAsync({
				serverUrl: d.serverUrl,
				appToken: d.appToken,
				priority: d.priority ?? 0,
				decoration: d.decoration,
			});
		},
		ntfy: (data) => {
			const d = data as ForType<"ntfy">;
			return testNtfy.mutateAsync({
				serverUrl: d.serverUrl,
				topic: d.topic,
				accessToken: d.accessToken || "",
				priority: d.priority ?? 0,
			});
		},
		mattermost: (data) => {
			const d = data as ForType<"mattermost">;
			return testMattermost.mutateAsync({
				webhookUrl: d.webhookUrl,
				channel: d.channel || undefined,
				username: d.username || undefined,
			});
		},
		lark: (data) => {
			const d = data as ForType<"lark">;
			return testLark.mutateAsync({ webhookUrl: d.webhookUrl });
		},
		teams: (data) => {
			const d = data as ForType<"teams">;
			return testTeams.mutateAsync({ webhookUrl: d.webhookUrl });
		},
		custom: (data) => {
			const d = data as ForType<"custom">;
			return testCustom.mutateAsync({
				endpoint: d.endpoint,
				headers: headersArrayToRecord(d.headers),
			});
		},
		pushover: (data) => {
			const d = data as ForType<"pushover">;
			// Guard preserved from the original: emergency priority needs retry/expire.
			if (d.priority === 2 && (d.retry == null || d.expire == null)) {
				throw new Error(
					"Retry and expire are required for emergency priority (2)",
				);
			}
			return testPushover.mutateAsync({
				userKey: d.userKey,
				apiToken: d.apiToken,
				priority: d.priority ?? 0,
				retry: d.priority === 2 ? d.retry : undefined,
				expire: d.priority === 2 ? d.expire : undefined,
			});
		},
	};

	const isTesting = [
		testSlack,
		testTelegram,
		testDiscord,
		testEmail,
		testResend,
		testGotify,
		testNtfy,
		testMattermost,
		testLark,
		testTeams,
		testCustom,
		testPushover,
	].some((m) => m.isPending);

	return { submitDispatch, testDispatch, activeMutation, isTesting };
};
