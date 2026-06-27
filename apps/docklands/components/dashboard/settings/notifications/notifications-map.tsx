import { Mail, PenBoxIcon } from "lucide-react";
import type { ComponentType } from "react";
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
import type { NotificationType } from "./notification-schema";

/**
 * Per-provider display + behavior metadata. One registry drives the provider
 * radio selector (`HandleNotifications`) and the saved-notifications list
 * (`ShowNotifications`), so adding a provider is a single map entry instead of
 * the manual `notificationType === "x" && <XIcon/>` ladders that previously
 * lived in both call sites (and that silently dropped pushover from the list).
 *
 * Each icon component takes a `className`; the selector and list pass their own
 * sizing/color so a single `Icon` reference serves both surfaces. Every custom
 * SVG icon defaults to `size-8`/`size-9`, so the selector deliberately passes no
 * size class and only the per-provider color tweaks that the original markup
 * applied (`text-kumo-subtle` for the muted brands).
 */
interface NotificationProviderMeta {
	Icon: ComponentType<{ className?: string }>;
	label: string;
	/** Class the provider radio selector renders the icon with. */
	selectorIconClassName?: string;
	/** Class the saved-notifications list renders the icon with. */
	listIconClassName: string;
}

/**
 * Ordered roughly by expected popularity for self-hosted operators so the most
 * common picks (Discord, Slack, Telegram) lead the selector grid. Object key
 * order is preserved by `Object.entries`, which is what drives both the
 * selector and the saved-notifications list rendering order.
 */
export const notificationsMap: Record<
	NotificationType,
	NotificationProviderMeta
> = {
	discord: {
		Icon: DiscordIcon,
		label: "Discord",
		listIconClassName: "size-7",
	},
	slack: {
		Icon: SlackIcon,
		label: "Slack",
		listIconClassName: "size-6",
	},
	telegram: {
		Icon: TelegramIcon,
		label: "Telegram",
		listIconClassName: "size-7",
	},
	email: {
		Icon: Mail,
		label: "Email",
		selectorIconClassName: "size-7 text-kumo-subtle",
		listIconClassName: "size-6 text-kumo-subtle",
	},
	teams: {
		Icon: TeamsIcon,
		label: "Microsoft Teams",
		listIconClassName: "size-7",
	},
	mattermost: {
		Icon: MattermostIcon,
		label: "Mattermost",
		listIconClassName: "size-7",
	},
	gotify: {
		Icon: GotifyIcon,
		label: "Gotify",
		listIconClassName: "size-6",
	},
	ntfy: {
		Icon: NtfyIcon,
		label: "ntfy",
		listIconClassName: "size-6",
	},
	pushover: {
		Icon: PushoverIcon,
		label: "Pushover",
		listIconClassName: "size-6",
	},
	lark: {
		Icon: LarkIcon,
		label: "Lark",
		selectorIconClassName: "text-kumo-subtle",
		listIconClassName: "size-7 text-kumo-subtle",
	},
	resend: {
		Icon: ResendIcon,
		label: "Resend",
		listIconClassName: "size-6",
	},
	custom: {
		Icon: PenBoxIcon,
		label: "Custom",
		selectorIconClassName: "size-7 text-kumo-subtle",
		listIconClassName: "size-6 text-kumo-subtle",
	},
};
