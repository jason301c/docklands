import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Switch } from "@cloudflare/kumo/components/switch";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertTriangle, Mail, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import {
	DiscordIcon,
	GotifyIcon,
	LarkIcon,
	MattermostIcon,
	NtfyIcon,
	PushoverIcon,
	ResendIcon,
	SlackIcon,
	TeamsIcon,
	TelegramIcon,
} from "@/components/icons/notification-icons";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import {
	CustomFields,
	DiscordFields,
	EmailFields,
	GotifyFields,
	LarkFields,
	MattermostFields,
	NtfyFields,
	PushoverFields,
	ResendFields,
	SlackFields,
	TeamsFields,
	TelegramFields,
} from "./provider-fields";

const logger = createClientLogger("notifications");

const notificationBaseSchema = z.object({
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

export const notificationsMap = {
	slack: {
		icon: <SlackIcon />,
		label: "Slack",
	},
	telegram: {
		icon: <TelegramIcon />,
		label: "Telegram",
	},
	discord: {
		icon: <DiscordIcon />,
		label: "Discord",
	},
	lark: {
		icon: <LarkIcon className="text-kumo-subtle" />,
		label: "Lark",
	},
	teams: {
		icon: <TeamsIcon className="text-kumo-subtle" />,
		label: "Microsoft Teams",
	},
	email: {
		icon: <Mail size={29} className="text-kumo-subtle" />,
		label: "Email",
	},
	resend: {
		icon: <ResendIcon className="text-kumo-subtle" />,
		label: "Resend",
	},
	gotify: {
		icon: <GotifyIcon />,
		label: "Gotify",
	},
	ntfy: {
		icon: <NtfyIcon />,
		label: "ntfy",
	},
	mattermost: {
		icon: <MattermostIcon />,
		label: "Mattermost",
	},
	pushover: {
		icon: <PushoverIcon />,
		label: "Pushover",
	},
	custom: {
		icon: <PenBoxIcon size={29} className="text-kumo-subtle" />,
		label: "Custom",
	},
};

export type NotificationSchema = z.infer<typeof notificationSchema>;
// The form's field values are the schema *input* (defaulted booleans are
// optional pre-parse); the resolver transforms them into `NotificationSchema`.
// The extracted provider field-sets type their `control` against these so it
// matches `form.control` exactly (see `provider-fields/types.ts`).
export type NotificationFormInput = z.input<typeof notificationSchema>;

interface Props {
	notificationId?: string;
}

export const HandleNotifications = ({ notificationId }: Props) => {
	const utils = api.useUtils();
	const [visible, setVisible] = useState(false);

	const { data: notification } = api.notification.one.useQuery(
		{
			notificationId: notificationId || "",
		},
		{
			enabled: !!notificationId,
		},
	);
	const { mutateAsync: testSlackConnection, isPending: isLoadingSlack } =
		api.notification.testSlackConnection.useMutation();
	const { mutateAsync: testTelegramConnection, isPending: isLoadingTelegram } =
		api.notification.testTelegramConnection.useMutation();
	const { mutateAsync: testDiscordConnection, isPending: isLoadingDiscord } =
		api.notification.testDiscordConnection.useMutation();
	const { mutateAsync: testEmailConnection, isPending: isLoadingEmail } =
		api.notification.testEmailConnection.useMutation();
	const { mutateAsync: testResendConnection, isPending: isLoadingResend } =
		api.notification.testResendConnection.useMutation();
	const { mutateAsync: testGotifyConnection, isPending: isLoadingGotify } =
		api.notification.testGotifyConnection.useMutation();
	const { mutateAsync: testNtfyConnection, isPending: isLoadingNtfy } =
		api.notification.testNtfyConnection.useMutation();
	const {
		mutateAsync: testMattermostConnection,
		isPending: isLoadingMattermost,
	} = api.notification.testMattermostConnection.useMutation();
	const { mutateAsync: testLarkConnection, isPending: isLoadingLark } =
		api.notification.testLarkConnection.useMutation();
	const { mutateAsync: testTeamsConnection, isPending: isLoadingTeams } =
		api.notification.testTeamsConnection.useMutation();
	const { mutateAsync: testCustomConnection, isPending: isLoadingCustom } =
		api.notification.testCustomConnection.useMutation();
	const { mutateAsync: testPushoverConnection, isPending: isLoadingPushover } =
		api.notification.testPushoverConnection.useMutation();

	const updateCustomMutation = api.notification.updateCustom.useMutation();
	const createCustomMutation = api.notification.createCustom.useMutation();
	const customMutation = notificationId
		? updateCustomMutation
		: createCustomMutation;
	const updateSlackMutation = api.notification.updateSlack.useMutation();
	const createSlackMutation = api.notification.createSlack.useMutation();
	const slackMutation = notificationId
		? updateSlackMutation
		: createSlackMutation;
	const updateTelegramMutation = api.notification.updateTelegram.useMutation();
	const createTelegramMutation = api.notification.createTelegram.useMutation();
	const telegramMutation = notificationId
		? updateTelegramMutation
		: createTelegramMutation;
	const updateDiscordMutation = api.notification.updateDiscord.useMutation();
	const createDiscordMutation = api.notification.createDiscord.useMutation();
	const discordMutation = notificationId
		? updateDiscordMutation
		: createDiscordMutation;
	const updateEmailMutation = api.notification.updateEmail.useMutation();
	const createEmailMutation = api.notification.createEmail.useMutation();
	const emailMutation = notificationId
		? updateEmailMutation
		: createEmailMutation;
	const updateResendMutation = api.notification.updateResend.useMutation();
	const createResendMutation = api.notification.createResend.useMutation();
	const resendMutation = notificationId
		? updateResendMutation
		: createResendMutation;
	const updateGotifyMutation = api.notification.updateGotify.useMutation();
	const createGotifyMutation = api.notification.createGotify.useMutation();
	const gotifyMutation = notificationId
		? updateGotifyMutation
		: createGotifyMutation;
	const updateNtfyMutation = api.notification.updateNtfy.useMutation();
	const createNtfyMutation = api.notification.createNtfy.useMutation();
	const ntfyMutation = notificationId ? updateNtfyMutation : createNtfyMutation;
	const updateMattermostMutation =
		api.notification.updateMattermost.useMutation();
	const createMattermostMutation =
		api.notification.createMattermost.useMutation();
	const mattermostMutation = notificationId
		? updateMattermostMutation
		: createMattermostMutation;
	const updateLarkMutation = api.notification.updateLark.useMutation();
	const createLarkMutation = api.notification.createLark.useMutation();
	const larkMutation = notificationId ? updateLarkMutation : createLarkMutation;
	const updateTeamsMutation = api.notification.updateTeams.useMutation();
	const createTeamsMutation = api.notification.createTeams.useMutation();
	const teamsMutation = notificationId
		? updateTeamsMutation
		: createTeamsMutation;
	const updatePushoverMutation = api.notification.updatePushover.useMutation();
	const createPushoverMutation = api.notification.createPushover.useMutation();
	const pushoverMutation = notificationId
		? updatePushoverMutation
		: createPushoverMutation;

	const form = useForm({
		defaultValues: {
			type: "slack",
			webhookUrl: "",
			channel: "",
			name: "",
		},
		resolver: zodResolver(notificationSchema),
	});
	const type = form.watch("type");

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "toAddresses" as never,
	});

	const {
		fields: headerFields,
		append: appendHeader,
		remove: removeHeader,
	} = useFieldArray({
		control: form.control,
		name: "headers" as never,
	});

	useEffect(() => {
		if ((type === "email" || type === "resend") && fields.length === 0) {
			append("");
		}
	}, [type, append, fields.length]);

	useEffect(() => {
		if (notification) {
			if (notification.notificationType === "slack") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					dockerCleanup: notification.dockerCleanup,
					webhookUrl: notification.slack?.webhookUrl,
					channel: notification.slack?.channel || "",
					name: notification.name,
					type: notification.notificationType,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "telegram") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					botToken: notification.telegram?.botToken,
					messageThreadId: notification.telegram?.messageThreadId || "",
					chatId: notification.telegram?.chatId,
					type: notification.notificationType,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "discord") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					webhookUrl: notification.discord?.webhookUrl,
					decoration: notification.discord?.decoration ?? undefined,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "email") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					smtpServer: notification.email?.smtpServer,
					smtpPort: notification.email?.smtpPort,
					username: notification.email?.username,
					password: notification.email?.password,
					toAddresses: notification.email?.toAddresses,
					fromAddress: notification.email?.fromAddress,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "resend") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					apiKey: notification.resend?.apiKey,
					toAddresses: notification.resend?.toAddresses,
					fromAddress: notification.resend?.fromAddress,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "gotify") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					appToken: notification.gotify?.appToken,
					decoration: notification.gotify?.decoration ?? undefined,
					priority: notification.gotify?.priority,
					serverUrl: notification.gotify?.serverUrl,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
				});
			} else if (notification.notificationType === "ntfy") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					accessToken: notification.ntfy?.accessToken || "",
					topic: notification.ntfy?.topic,
					priority: notification.ntfy?.priority,
					serverUrl: notification.ntfy?.serverUrl,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "mattermost") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					webhookUrl: notification.mattermost?.webhookUrl,
					channel: notification.mattermost?.channel || "",
					username: notification.mattermost?.username || "",
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "lark") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					type: notification.notificationType,
					webhookUrl: notification.lark?.webhookUrl,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					volumeBackup: notification.volumeBackup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "teams") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					webhookUrl: notification.teams?.webhookUrl,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "custom") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					type: notification.notificationType,
					endpoint: notification.custom?.endpoint || "",
					headers: notification.custom?.headers
						? Object.entries(notification.custom.headers).map(
								([key, value]) => ({
									key,
									value,
								}),
							)
						: [],
					name: notification.name,
					volumeBackup: notification.volumeBackup,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			} else if (notification.notificationType === "pushover") {
				form.reset({
					appBuildError: notification.appBuildError,
					appDeploy: notification.appDeploy,
					docklandsRestart: notification.docklandsRestart,
					databaseBackup: notification.databaseBackup,
					docklandsBackup: notification.docklandsBackup,
					volumeBackup: notification.volumeBackup,
					type: notification.notificationType,
					userKey: notification.pushover?.userKey,
					apiToken: notification.pushover?.apiToken,
					priority: notification.pushover?.priority,
					retry: notification.pushover?.retry ?? undefined,
					expire: notification.pushover?.expire ?? undefined,
					name: notification.name,
					dockerCleanup: notification.dockerCleanup,
					serverThreshold: notification.serverThreshold,
				});
			}
		} else {
			form.reset();
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, notification]);

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
	};

	// Per-provider submit dispatch. Each entry builds the EXACT payload its
	// original if/else branch sent and calls the matching create/update mutation
	// (already resolved above into the `*Mutation` handles). `data` is the
	// discriminated-union member for that `type`, so the per-provider fields are
	// available without re-narrowing. Note the deliberate quirks preserved from
	// the original branches: gotify and ntfy omit `serverThreshold`; mattermost
	// coerces empty channel/username to `undefined`; telegram/ntfy coerce
	// optional tokens to `""`; custom flattens the headers array to a record;
	// pushover only sends retry/expire for emergency priority (2). Pushover's
	// pre-submit guard can't live in a payload builder, so it stays special-cased
	// in `onSubmit` below.
	const submitDispatch: Record<
		NotificationSchema["type"],
		(data: NotificationSchema) => Promise<unknown>
	> = {
		slack: (data) => {
			const d = data as Extract<NotificationSchema, { type: "slack" }>;
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
				slackId: notification?.slackId || "",
				notificationId: notificationId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		telegram: (data) => {
			const d = data as Extract<NotificationSchema, { type: "telegram" }>;
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
				notificationId: notificationId || "",
				telegramId: notification?.telegramId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		discord: (data) => {
			const d = data as Extract<NotificationSchema, { type: "discord" }>;
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
				notificationId: notificationId || "",
				discordId: notification?.discordId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		email: (data) => {
			const d = data as Extract<NotificationSchema, { type: "email" }>;
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
				notificationId: notificationId || "",
				emailId: notification?.emailId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		resend: (data) => {
			const d = data as Extract<NotificationSchema, { type: "resend" }>;
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
				notificationId: notificationId || "",
				resendId: notification?.resendId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		gotify: (data) => {
			const d = data as Extract<NotificationSchema, { type: "gotify" }>;
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
				notificationId: notificationId || "",
				gotifyId: notification?.gotifyId || "",
			});
		},
		ntfy: (data) => {
			const d = data as Extract<NotificationSchema, { type: "ntfy" }>;
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
				notificationId: notificationId || "",
				ntfyId: notification?.ntfyId || "",
			});
		},
		mattermost: (data) => {
			const d = data as Extract<NotificationSchema, { type: "mattermost" }>;
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
				notificationId: notificationId || "",
				mattermostId: notification?.mattermostId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		lark: (data) => {
			const d = data as Extract<NotificationSchema, { type: "lark" }>;
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
				notificationId: notificationId || "",
				larkId: notification?.larkId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		teams: (data) => {
			const d = data as Extract<NotificationSchema, { type: "teams" }>;
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
				notificationId: notificationId || "",
				teamsId: notification?.teamsId || "",
				serverThreshold: d.serverThreshold,
			});
		},
		custom: (data) => {
			const d = data as Extract<NotificationSchema, { type: "custom" }>;
			// Convert headers array to object
			const headersRecord =
				d.headers && d.headers.length > 0
					? d.headers.reduce(
							(acc, { key, value }) => {
								if (key.trim()) acc[key] = value;
								return acc;
							},
							{} as Record<string, string>,
						)
					: undefined;

			return customMutation.mutateAsync({
				appBuildError: d.appBuildError,
				appDeploy: d.appDeploy,
				docklandsRestart: d.docklandsRestart,
				databaseBackup: d.databaseBackup,
				docklandsBackup: d.docklandsBackup,
				volumeBackup: d.volumeBackup,
				endpoint: d.endpoint,
				headers: headersRecord,
				name: d.name,
				dockerCleanup: d.dockerCleanup,
				serverThreshold: d.serverThreshold,
				notificationId: notificationId || "",
				customId: notification?.customId || "",
			});
		},
		pushover: (data) => {
			const d = data as Extract<NotificationSchema, { type: "pushover" }>;
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
				serverThreshold: d.serverThreshold,
				notificationId: notificationId || "",
				pushoverId: notification?.pushoverId || "",
			});
		},
	};

	const onSubmit = async (data: NotificationSchema) => {
		if (
			data.type === "pushover" &&
			data.priority === 2 &&
			(data.retry == null || data.expire == null)
		) {
			toast.error("Retry and expire are required for emergency priority (2)");
			return;
		}

		const promise = submitDispatch[data.type](data);

		if (promise) {
			await promise
				.then(async () => {
					toast.success(
						notificationId ? "Notification Updated" : "Notification Created",
					);
					form.reset({
						type: "slack",
						webhookUrl: "",
					});
					setVisible(false);
					await utils.notification.all.invalidate();
					if (notificationId) {
						await utils.notification.one.invalidate({ notificationId });
					}
				})
				.catch((err) => {
					logger.error(err);
					toast.error(
						notificationId
							? "Error updating a notification"
							: "Error creating a notification",
					);
				});
		}
	};
	return (
		<Dialog.Root open={visible} onOpenChange={setVisible}>
			<Dialog.Trigger
				className=""
				render={
					notificationId ? (
						<Button
							aria-label="Edit notification"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 "
						>
							<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((
							<Button className="cursor-pointer space-x-3">
								<PlusIcon className="h-4 w-4" />
								Add Notification
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-3xl">
				<div>
					<Dialog.Title>
						{notificationId ? "Update" : "Add"} Notification
					</Dialog.Title>
					<Dialog.Description>
						{notificationId
							? "Update your notification providers for multiple channels."
							: "Create new notification providers for multiple channels."}
					</Dialog.Description>
				</div>
				<Form {...form}>
					<form
						id="hook-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-8 "
					>
						<FormField
							control={form.control}
							defaultValue={form.control._defaultValues.type}
							name="type"
							render={({ field }) => (
								<FormItem className="space-y-3">
									<FormLabel className="text-kumo-subtle">
										Select a provider
									</FormLabel>
									<FormControl>
										<Radio.Group
											onValueChange={field.onChange}
											defaultValue={field.value}
											orientation="horizontal"
											appearance="card"
											className="w-full"
										>
											<Radio.Legend className="sr-only">
												Select a provider
											</Radio.Legend>
											{Object.entries(notificationsMap).map(([key, value]) => (
												<Radio.Item
													key={key}
													value={key}
													className="min-h-24"
													label={
														<span className="flex flex-col items-center gap-2 text-center">
															{value.icon}
															<span>{value.label}</span>
														</span>
													}
												/>
											))}
										</Radio.Group>
									</FormControl>
									<FormMessage />
									{activeMutation[field.value].isError && (
										<div className="flex flex-row gap-4 rounded-lg bg-kumo-danger-tint p-2">
											<AlertTriangle className="text-kumo-danger" />
											<span className="text-sm text-kumo-danger">
												{activeMutation[field.value].error?.message}
											</span>
										</div>
									)}
								</FormItem>
							)}
						/>

						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Fill the next fields.
							</FormLabel>
							<div className="flex flex-col gap-2">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input placeholder="Name" {...field} />
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>

								{type === "slack" && <SlackFields control={form.control} />}

								{type === "telegram" && (
									<TelegramFields control={form.control} />
								)}

								{type === "discord" && <DiscordFields control={form.control} />}

								{type === "email" && (
									<EmailFields
										control={form.control}
										form={form}
										type={type}
										fields={fields}
										append={append}
										remove={remove}
									/>
								)}

								{type === "resend" && (
									<ResendFields
										control={form.control}
										form={form}
										type={type}
										fields={fields}
										append={append}
										remove={remove}
									/>
								)}

								{type === "gotify" && <GotifyFields control={form.control} />}

								{type === "ntfy" && <NtfyFields control={form.control} />}

								{type === "mattermost" && (
									<MattermostFields control={form.control} />
								)}

								{type === "custom" && (
									<CustomFields
										control={form.control}
										headerFields={headerFields}
										appendHeader={appendHeader}
										removeHeader={removeHeader}
									/>
								)}

								{type === "lark" && <LarkFields control={form.control} />}

								{type === "teams" && <TeamsFields control={form.control} />}
								{type === "pushover" && (
									<PushoverFields
										control={form.control}
										priority={form.watch("priority")}
									/>
								)}
							</div>
						</div>
						<div className="flex flex-col gap-4">
							<FormLabel className="text-lg font-semibold leading-none tracking-tight">
								Select the actions.
							</FormLabel>

							<div className="grid md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="appDeploy"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="">
												<FormLabel>App Build</FormLabel>
												<FormDescription>
													Trigger the action when an app build completes.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="appBuildError"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>App Build Error</FormLabel>
												<FormDescription>
													Trigger the action when the build fails.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="databaseBackup"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Database Backup</FormLabel>
												<FormDescription>
													Trigger the action when a database backup is created.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="docklandsBackup"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Docklands Backup</FormLabel>
												<FormDescription>
													Trigger the action when a Docklands backup is created.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="volumeBackup"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Volume Backup</FormLabel>
												<FormDescription>
													Trigger the action when a volume backup is created.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="dockerCleanup"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Runtime Cleanup</FormLabel>
												<FormDescription>
													Trigger the action when runtime cleanup is performed.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="docklandsRestart"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Docklands Restart</FormLabel>
												<FormDescription>
													Trigger the action when Docklands is restarted.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="serverThreshold"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-2">
											<div className="space-y-0.5">
												<FormLabel>Server Threshold</FormLabel>
												<FormDescription>
													Trigger the action when host CPU or memory usage
													crosses the configured threshold.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							</div>
						</div>
					</form>

					<div className="flex flex-row gap-2 !justify-between w-full">
						<Button
							loading={
								isLoadingSlack ||
								isLoadingTelegram ||
								isLoadingDiscord ||
								isLoadingEmail ||
								isLoadingResend ||
								isLoadingGotify ||
								isLoadingNtfy ||
								isLoadingMattermost ||
								isLoadingLark ||
								isLoadingTeams ||
								isLoadingCustom ||
								isLoadingPushover
							}
							variant="secondary"
							type="button"
							onClick={async () => {
								const isValid = await form.trigger();
								if (!isValid) return;

								const data = form.getValues();

								try {
									if (data.type === "slack") {
										await testSlackConnection({
											webhookUrl: data.webhookUrl,
											channel: data.channel,
										});
									} else if (data.type === "telegram") {
										await testTelegramConnection({
											botToken: data.botToken,
											chatId: data.chatId,
											messageThreadId: data.messageThreadId || "",
										});
									} else if (data.type === "discord") {
										await testDiscordConnection({
											webhookUrl: data.webhookUrl,
											decoration: data.decoration,
										});
									} else if (data.type === "email") {
										await testEmailConnection({
											smtpServer: data.smtpServer,
											smtpPort: data.smtpPort,
											username: data.username,
											password: data.password,
											fromAddress: data.fromAddress,
											toAddresses: data.toAddresses,
										});
									} else if (data.type === "resend") {
										await testResendConnection({
											apiKey: data.apiKey,
											fromAddress: data.fromAddress,
											toAddresses: data.toAddresses,
										});
									} else if (data.type === "gotify") {
										await testGotifyConnection({
											serverUrl: data.serverUrl,
											appToken: data.appToken,
											priority: data.priority ?? 0,
											decoration: data.decoration,
										});
									} else if (data.type === "ntfy") {
										await testNtfyConnection({
											serverUrl: data.serverUrl,
											topic: data.topic,
											accessToken: data.accessToken || "",
											priority: data.priority ?? 0,
										});
									} else if (data.type === "mattermost") {
										await testMattermostConnection({
											webhookUrl: data.webhookUrl,
											channel: data.channel || undefined,
											username: data.username || undefined,
										});
									} else if (data.type === "lark") {
										await testLarkConnection({
											webhookUrl: data.webhookUrl,
										});
									} else if (data.type === "teams") {
										await testTeamsConnection({
											webhookUrl: data.webhookUrl,
										});
									} else if (data.type === "custom") {
										const headersRecord =
											data.headers && data.headers.length > 0
												? data.headers.reduce(
														(acc, { key, value }) => {
															if (key.trim()) acc[key] = value;
															return acc;
														},
														{} as Record<string, string>,
													)
												: undefined;
										await testCustomConnection({
											endpoint: data.endpoint,
											headers: headersRecord,
										});
									} else if (data.type === "pushover") {
										if (
											data.priority === 2 &&
											(data.retry == null || data.expire == null)
										) {
											throw new Error(
												"Retry and expire are required for emergency priority (2)",
											);
										}
										await testPushoverConnection({
											userKey: data.userKey,
											apiToken: data.apiToken,
											priority: data.priority ?? 0,
											retry: data.priority === 2 ? data.retry : undefined,
											expire: data.priority === 2 ? data.expire : undefined,
										});
									}
									toast.success("Connection Success");
								} catch (error) {
									toast.error(
										`Error testing the provider: ${error instanceof Error ? error.message : "Unknown error"}`,
									);
								}
							}}
						>
							Test Notification
						</Button>
						<Button
							loading={form.formState.isSubmitting}
							form="hook-form"
							type="submit"
						>
							{notificationId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
