import type { NotificationType } from "../notification-schema";
import {
	EmailListField,
	type FieldName,
	HeadersField,
	NumberField,
	SwitchField,
	TextField,
} from "./fields";
import type { NotificationForm, NotificationFormControl } from "./types";

/**
 * A single declarative field in a provider's connection form. The registry
 * below describes each provider as an ordered list of these specs, and
 * `ProviderFields` renders them with the shared primitives in `fields.tsx`.
 * Adding/adjusting a provider's form is a data edit here, not new JSX.
 */
type FieldSpec =
	| {
			kind: "text";
			name: FieldName;
			label: string;
			placeholder?: string;
			description?: string;
			password?: boolean;
	  }
	| {
			kind: "number";
			name: FieldName;
			label: string;
			placeholder?: string;
			description?: string;
			min?: number;
			max?: number;
			default?: number;
			emptyValue?: number;
	  }
	| {
			kind: "switch";
			name: FieldName;
			label: string;
			description?: string;
			default?: boolean;
	  }
	/** Two (or more) fields laid out side-by-side on wide viewports. */
	| { kind: "row"; fields: FieldSpec[] }
	/** Render the given fields only while `field` equals `equals`. */
	| { kind: "when"; field: FieldName; equals: unknown; fields: FieldSpec[] }
	| { kind: "emailList" }
	| { kind: "headers" };

/** Per-provider connection-form field lists. */
export const PROVIDER_FIELDS: Record<NotificationType, FieldSpec[]> = {
	slack: [
		{
			kind: "text",
			name: "webhookUrl",
			label: "Webhook URL",
			placeholder:
				"https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
		},
		{ kind: "text", name: "channel", label: "Channel", placeholder: "Channel" },
	],
	telegram: [
		{
			kind: "text",
			name: "botToken",
			label: "Bot Token",
			placeholder: "6660491268:AAFMGmajZOVewpMNZCgJr5H7cpXpoZPgvXw",
		},
		{
			kind: "text",
			name: "chatId",
			label: "Chat ID",
			placeholder: "431231869",
		},
		{
			kind: "text",
			name: "messageThreadId",
			label: "Message Thread ID",
			placeholder: "11",
			description:
				"Optional. Use it when you want to send notifications to a specific topic in a group.",
		},
	],
	discord: [
		{
			kind: "text",
			name: "webhookUrl",
			label: "Webhook URL",
			placeholder:
				"https://discord.com/api/webhooks/123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ",
		},
		{
			kind: "switch",
			name: "decoration",
			label: "Decoration",
			description: "Decorate the notification with emojis.",
			default: true,
		},
	],
	email: [
		{
			kind: "row",
			fields: [
				{
					kind: "text",
					name: "smtpServer",
					label: "SMTP Server",
					placeholder: "smtp.gmail.com",
				},
				{
					kind: "number",
					name: "smtpPort",
					label: "SMTP Port",
					placeholder: "587",
					min: 1,
					max: 65535,
				},
			],
		},
		{
			kind: "row",
			fields: [
				{
					kind: "text",
					name: "username",
					label: "Username",
					placeholder: "username",
				},
				{
					kind: "text",
					name: "password",
					label: "Password",
					placeholder: "******************",
					password: true,
				},
			],
		},
		{
			kind: "text",
			name: "fromAddress",
			label: "From Address",
			placeholder: "from@example.com",
		},
		{ kind: "emailList" },
	],
	resend: [
		{
			kind: "text",
			name: "apiKey",
			label: "API Key",
			placeholder: "re_********",
			password: true,
		},
		{
			kind: "text",
			name: "fromAddress",
			label: "From Address",
			placeholder: "from@example.com",
		},
		{ kind: "emailList" },
	],
	gotify: [
		{
			kind: "text",
			name: "serverUrl",
			label: "Server URL",
			placeholder: "https://gotify.example.com",
		},
		{
			kind: "text",
			name: "appToken",
			label: "App Token",
			placeholder: "AzxcvbnmKjhgfdsa...",
		},
		{
			kind: "number",
			name: "priority",
			label: "Priority",
			placeholder: "5",
			min: 1,
			max: 10,
			default: 5,
			description: "Message priority (1-10, default: 5)",
		},
		{
			kind: "switch",
			name: "decoration",
			label: "Decoration",
			description: "Decorate the notification with emojis.",
			default: true,
		},
	],
	ntfy: [
		{
			kind: "text",
			name: "serverUrl",
			label: "Server URL",
			placeholder: "https://ntfy.sh",
		},
		{ kind: "text", name: "topic", label: "Topic", placeholder: "builds" },
		{
			kind: "text",
			name: "accessToken",
			label: "Access Token",
			placeholder: "AzxcvbnmKjhgfdsa...",
			description: "Optional. Leave blank for public topics.",
		},
		{
			kind: "number",
			name: "priority",
			label: "Priority",
			placeholder: "3",
			min: 1,
			max: 5,
			default: 3,
			description: "Message priority (1-5, default: 3)",
		},
	],
	mattermost: [
		{
			kind: "text",
			name: "webhookUrl",
			label: "Webhook URL",
			placeholder: "https://your-mattermost.com/hooks/xxx-generatedkey-xxx",
		},
		{
			kind: "text",
			name: "channel",
			label: "Channel",
			placeholder: "builds",
			description: "Optional. Channel to post to (without #).",
		},
		{
			kind: "text",
			name: "username",
			label: "Username",
			placeholder: "Docklands",
			description: "Optional. Display name for the webhook.",
		},
	],
	pushover: [
		{
			kind: "text",
			name: "userKey",
			label: "User Key",
			placeholder: "ub3de9kl2q...",
		},
		{
			kind: "text",
			name: "apiToken",
			label: "API Token",
			placeholder: "a3d9k2q7m4...",
		},
		{
			kind: "number",
			name: "priority",
			label: "Priority",
			placeholder: "0",
			min: -2,
			max: 2,
			default: 0,
			emptyValue: 0,
			description: "Message priority (-2 to 2, default: 0, emergency: 2)",
		},
		{
			kind: "when",
			field: "priority",
			equals: 2,
			fields: [
				{
					kind: "number",
					name: "retry",
					label: "Retry (seconds)",
					placeholder: "30",
					min: 30,
					description: "How often (in seconds) to retry. Minimum 30 seconds.",
				},
				{
					kind: "number",
					name: "expire",
					label: "Expire (seconds)",
					placeholder: "3600",
					min: 1,
					max: 10800,
					description:
						"How long to keep retrying (max 10800 seconds / 3 hours).",
				},
			],
		},
	],
	custom: [
		{
			kind: "text",
			name: "endpoint",
			label: "Webhook URL",
			placeholder: "https://api.example.com/webhook",
			description:
				"The URL where POST requests will be sent with notification data.",
		},
		{ kind: "headers" },
	],
	lark: [
		{
			kind: "text",
			name: "webhookUrl",
			label: "Webhook URL",
			placeholder:
				"https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxxxxxxxxx",
		},
	],
	teams: [
		{
			kind: "text",
			name: "webhookUrl",
			label: "Webhook URL",
			placeholder: "https://xxx.webhook.office.com/webhookb2/...",
			description:
				"Incoming Webhook URL from a Teams channel. Add an Incoming Webhook in your channel settings to get the URL.",
		},
	],
};

interface FieldRendererProps {
	spec: FieldSpec;
	control: NotificationFormControl;
	form: NotificationForm;
}

const FieldRenderer = ({ spec, control, form }: FieldRendererProps) => {
	switch (spec.kind) {
		case "text":
			return (
				<TextField
					control={control}
					name={spec.name}
					label={spec.label}
					placeholder={spec.placeholder}
					description={spec.description}
					password={spec.password}
				/>
			);
		case "number":
			return (
				<NumberField
					control={control}
					name={spec.name}
					label={spec.label}
					placeholder={spec.placeholder}
					description={spec.description}
					min={spec.min}
					max={spec.max}
					defaultValue={spec.default}
					emptyValue={spec.emptyValue}
				/>
			);
		case "switch":
			return (
				<SwitchField
					control={control}
					name={spec.name}
					label={spec.label}
					description={spec.description}
					defaultValue={spec.default}
				/>
			);
		case "row":
			return (
				<div className="flex w-full flex-col gap-2 md:flex-row">
					{spec.fields.map((child, index) => (
						<FieldRenderer
							key={index}
							spec={child}
							control={control}
							form={form}
						/>
					))}
				</div>
			);
		case "when":
			return form.watch(spec.field) === spec.equals ? (
				<>
					{spec.fields.map((child, index) => (
						<FieldRenderer
							key={index}
							spec={child}
							control={control}
							form={form}
						/>
					))}
				</>
			) : null;
		case "emailList":
			return <EmailListField control={control} form={form} />;
		case "headers":
			return <HeadersField control={control} />;
	}
};

interface ProviderFieldsProps {
	type: NotificationType;
	control: NotificationFormControl;
	form: NotificationForm;
}

/**
 * Renders the connection-form fields for the selected provider from the
 * registry. Replaces the twelve `XFields` components and the per-provider
 * `{type === "x" && <XFields/>}` ladder in `HandleNotifications`.
 */
export const ProviderFields = ({
	type,
	control,
	form,
}: ProviderFieldsProps) => (
	<>
		{PROVIDER_FIELDS[type].map((spec, index) => (
			<FieldRenderer key={index} spec={spec} control={control} form={form} />
		))}
	</>
);
