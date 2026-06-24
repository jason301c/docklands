import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { notifications } from "@/server/core/db/schema";
import {
	sendEmailNotification,
	sendResendNotification,
} from "@/server/core/utils/notifications/utils";

/**
 * Unified transactional ("system") email.
 *
 * Docklands has a single source of truth for outbound email: the email-capable
 * **notification providers** (SMTP or Resend) configured under
 * Settings → Notifications. Password reset, email verification, and invitations
 * all flow through `sendSystemEmail` rather than a separate, env-configured SMTP
 * path. There is exactly one organization per instance, so "the org's email
 * provider" is "the instance's email provider".
 *
 * When no provider is configured these functions report it honestly
 * (`isSystemEmailConfigured` → false; `sendSystemEmail` throws
 * `SystemEmailNotConfiguredError`) so callers can surface an accurate message
 * instead of pretending an email was sent.
 */

export class SystemEmailNotConfiguredError extends Error {
	constructor() {
		super("No email provider is configured for this instance.");
		this.name = "SystemEmailNotConfiguredError";
	}
}

/** The single organization id for this instance (one org per install). */
export const getInstanceOrganizationId = async (): Promise<string | null> => {
	const org = await db.query.organization.findFirst({ columns: { id: true } });
	return org?.id ?? null;
};

/**
 * Resolve the org's configured email provider (SMTP `email` or `resend`), or
 * null when none exists. The first email-capable notification wins; a typical
 * instance has exactly one.
 */
export const getSystemEmailProvider = async (organizationId: string) => {
	const providers = await db.query.notifications.findMany({
		where: eq(notifications.organizationId, organizationId),
		with: { email: true, resend: true },
	});
	return (
		providers.find((provider) => provider.email || provider.resend) ?? null
	);
};

/** Whether this instance can send transactional email at all. */
export const isSystemEmailConfigured = async (
	organizationId?: string | null,
): Promise<boolean> => {
	const orgId = organizationId ?? (await getInstanceOrganizationId());
	if (!orgId) return false;
	return (await getSystemEmailProvider(orgId)) !== null;
};

/**
 * Send a transactional email through the instance's configured provider.
 * Throws `SystemEmailNotConfiguredError` when no email provider exists — callers
 * that run in a "best effort" context (e.g. Better Auth's background email send)
 * should expect this and surface honest copy upstream.
 */
export const sendSystemEmail = async ({
	organizationId,
	to,
	subject,
	html,
	attachments,
}: {
	organizationId?: string | null;
	to: string;
	subject: string;
	html: string;
	attachments?: { filename: string; content: Buffer }[];
}): Promise<void> => {
	const orgId = organizationId ?? (await getInstanceOrganizationId());
	const provider = orgId ? await getSystemEmailProvider(orgId) : null;

	if (provider?.email) {
		await sendEmailNotification(
			{ ...provider.email, toAddresses: [to] },
			subject,
			html,
			attachments,
		);
		return;
	}
	if (provider?.resend) {
		await sendResendNotification(
			{ ...provider.resend, toAddresses: [to] },
			subject,
			html,
		);
		return;
	}

	throw new SystemEmailNotConfiguredError();
};
