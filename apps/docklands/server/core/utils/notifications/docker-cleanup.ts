import { render } from "@react-email/components";
import { format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { notifications } from "@/server/core/db/schema";
import DockerCleanupEmail from "@/server/core/emails/emails/docker-cleanup";
import {
	sendCustomNotification,
	sendDiscordNotification,
	sendEmailNotification,
	sendGotifyNotification,
	sendLarkNotification,
	sendMattermostNotification,
	sendNtfyNotification,
	sendPushoverNotification,
	sendResendNotification,
	sendSlackNotification,
	sendTeamsNotification,
	sendTelegramNotification,
} from "./utils";

export const sendDockerCleanupNotifications = async (
	organizationId: string,
	message = "Container runtime cleanup for Docklands",
) => {
	const date = new Date();
	const unixDate = ~~(Number(date) / 1000);
	const notificationList = await db.query.notifications.findMany({
		where: and(
			eq(notifications.dockerCleanup, true),
			eq(notifications.organizationId, organizationId),
		),
		with: {
			email: true,
			discord: true,
			telegram: true,
			slack: true,
			resend: true,
			gotify: true,
			ntfy: true,
			mattermost: true,
			custom: true,
			lark: true,
			pushover: true,
			teams: true,
		},
	});

	for (const notification of notificationList) {
		const {
			email,
			resend,
			discord,
			telegram,
			slack,
			gotify,
			ntfy,
			mattermost,
			custom,
			lark,
			pushover,
			teams,
		} = notification;
		try {
			if (email || resend) {
				const template = await render(
					DockerCleanupEmail({ message, date: date.toLocaleString() }),
				).catch();

				if (email) {
					await sendEmailNotification(
						email,
						"Container runtime cleanup for Docklands",
						template,
					);
				}

				if (resend) {
					await sendResendNotification(
						resend,
						"Container runtime cleanup for Docklands",
						template,
					);
				}
			}

			if (discord) {
				const decorate = (decoration: string, text: string) =>
					`${discord.decoration ? decoration : ""} ${text}`.trim();

				await sendDiscordNotification(discord, {
					title: decorate(">", "`✅` Container Runtime Cleanup"),
					color: 0x57f287,
					fields: [
						{
							name: decorate("`📅`", "Date"),
							value: `<t:${unixDate}:D>`,
							inline: true,
						},
						{
							name: decorate("`⌚`", "Time"),
							value: `<t:${unixDate}:t>`,
							inline: true,
						},
						{
							name: decorate("`❓`", "Type"),
							value: "Successful",
							inline: true,
						},
						{
							name: decorate("`📜`", "Message"),
							value: `\`\`\`${message}\`\`\``,
						},
					],
					timestamp: date.toISOString(),
					footer: {
						text: "Docklands Container Runtime Cleanup Notification",
					},
				});
			}

			if (gotify) {
				const decorate = (decoration: string, text: string) =>
					`${gotify.decoration ? decoration : ""} ${text}\n`;
				await sendGotifyNotification(
					gotify,
					decorate("✅", "Container Runtime Cleanup"),
					`${decorate("🕒", `Date: ${date.toLocaleString()}`)}` +
						`${decorate("📜", `Message:\n${message}`)}`,
				);
			}

			if (ntfy) {
				await sendNtfyNotification(
					ntfy,
					"Container Runtime Cleanup",
					"white_check_mark",
					"",
					`🕒Date: ${date.toLocaleString()}\n` + `📜Message:\n${message}`,
				);
			}

			if (telegram) {
				await sendTelegramNotification(
					telegram,
					`<b>✅ Container Runtime Cleanup</b>\n\n<b>Message:</b> ${message}\n<b>Date:</b> ${format(date, "PP")}\n<b>Time:</b> ${format(date, "pp")}`,
				);
			}

			if (slack) {
				const { channel } = slack;
				await sendSlackNotification(slack, {
					channel: channel,
					attachments: [
						{
							color: "#00FF00",
							pretext: ":white_check_mark: *Container Runtime Cleanup*",
							fields: [
								{
									title: "Message",
									value: message,
								},
								{
									title: "Time",
									value: date.toLocaleString(),
									short: true,
								},
							],
						},
					],
				});
			}

			if (mattermost) {
				await sendMattermostNotification(mattermost, {
					text: `**✅ Container Runtime Cleanup**\n\n**Message:** ${message}\n**Date:** ${format(date, "PP")}\n**Time:** ${format(date, "pp")}`,
					channel: mattermost.channel,
					username: mattermost.username || "Docklands",
				});
			}

			if (custom) {
				await sendCustomNotification(custom, {
					title: "Container Runtime Cleanup",
					message: "Container runtime cleanup completed successfully",
					cleanupMessage: message,
					timestamp: date.toISOString(),
					date: date.toLocaleString(),
					status: "success",
					type: "docker-cleanup",
				});
			}

			if (lark) {
				await sendLarkNotification(lark, {
					msg_type: "interactive",
					card: {
						schema: "2.0",
						config: {
							update_multi: true,
							style: {
								text_size: {
									normal_v2: {
										default: "normal",
										pc: "normal",
										mobile: "heading",
									},
								},
							},
						},
						header: {
							title: {
								tag: "plain_text",
								content: "✅ Container Runtime Cleanup",
							},
							subtitle: {
								tag: "plain_text",
								content: "",
							},
							template: "green",
							padding: "12px 12px 12px 12px",
						},
						body: {
							direction: "vertical",
							padding: "12px 12px 12px 12px",
							elements: [
								{
									tag: "column_set",
									columns: [
										{
											tag: "column",
											width: "weighted",
											elements: [
												{
													tag: "markdown",
													content: "**Status:**\nSuccessful",
													text_align: "left",
													text_size: "normal_v2",
												},
												{
													tag: "markdown",
													content: `**Cleanup Details:**\n${message}`,
													text_align: "left",
													text_size: "normal_v2",
												},
											],
											vertical_align: "top",
											weight: 1,
										},
										{
											tag: "column",
											width: "weighted",
											elements: [
												{
													tag: "markdown",
													content: `**Date:**\n${format(date, "PP pp")}`,
													text_align: "left",
													text_size: "normal_v2",
												},
											],
											vertical_align: "top",
											weight: 1,
										},
									],
								},
							],
						},
					},
				});
			}

			if (pushover) {
				await sendPushoverNotification(
					pushover,
					"Container Runtime Cleanup",
					`Date: ${date.toLocaleString()}\nMessage: ${message}`,
				);
			}

			if (teams) {
				await sendTeamsNotification(teams, {
					title: "✅ Container Runtime Cleanup",
					facts: [
						{ name: "Date", value: format(date, "PP pp") },
						{ name: "Message", value: message },
					],
				});
			}
		} catch (error) {
			console.log(error);
		}
	}
};
