import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	invitation,
	member,
	organization,
	user,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("auth");

export const findUserById = async (userId: string) => {
	return orThrowNotFound(
		db.query.user.findFirst({
			where: eq(user.id, userId),
			// with: {
			// 	account: true,
			// },
		}),
		"User",
	);
};

export const findOrganizationById = async (organizationId: string) => {
	const organizationResult = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		with: {
			owner: true,
		},
	});
	return organizationResult;
};

export const isAdminPresent = async () => {
	const admin = await db.query.member.findFirst({
		where: eq(member.role, "owner"),
	});

	if (!admin) {
		return false;
	}
	return true;
};

export const findOwner = async () => {
	return orThrowNotFound(
		db.query.member.findFirst({
			where: eq(member.role, "owner"),
			with: {
				user: true,
			},
		}),
		"Admin",
	);
};

export const getUserByToken = async (token: string) => {
	const userResult = await db.query.invitation.findFirst({
		where: eq(invitation.id, token),
		columns: {
			id: true,
			email: true,
			status: true,
			expiresAt: true,
			role: true,
			inviterId: true,
		},
	});

	if (!userResult) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Invitation not found",
		});
	}

	const userAlreadyExists = await db.query.user.findFirst({
		where: eq(user.email, userResult?.email || ""),
	});

	const { expiresAt, ...rest } = userResult;
	return {
		...rest,
		isExpired: userResult.expiresAt < new Date(),
		userAlreadyExists: !!userAlreadyExists,
	};
};

export const removeUserById = async (userId: string) => {
	await db
		.delete(user)
		.where(eq(user.id, userId))
		.returning()
		.then((res) => res[0]);
};

export const getTrustedOrigins = async () => {
	const runQuery = async () => {
		const rows = await db
			.select({ trustedOrigins: user.trustedOrigins })
			.from(member)
			.innerJoin(user, eq(member.userId, user.id))
			.where(eq(member.role, "owner"));
		return Array.from(new Set(rows.flatMap((r) => r.trustedOrigins ?? [])));
	};

	try {
		return await runQuery();
	} catch (error) {
		logger.error({ err: error }, "Failed to fetch trusted origins");
		logger.warn({}, "Trusted-origin set is degraded; returning empty list");
		return [];
	}
};
