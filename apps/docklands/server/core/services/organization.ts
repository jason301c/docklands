import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/server/core/db";
import {
	invitation,
	member,
	organization,
	organizationRole,
	user,
} from "@/server/core/db/schema";

/**
 * When assigning a non-builtin role, verify the custom role actually exists in
 * the org. Shared by `inviteMember` and `updateMemberRole`. The two callers used
 * slightly different not-found messages, so the message is passed in to preserve
 * each one exactly.
 */
export const assertCustomRoleExists = async (
	orgId: string,
	role: string,
	notFoundMessage: string,
) => {
	const customRole = await db.query.organizationRole.findFirst({
		where: and(
			eq(organizationRole.organizationId, orgId),
			eq(organizationRole.role, role),
		),
	});

	if (!customRole) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: notFoundMessage,
		});
	}
};

export const inviteMember = async ({
	orgId,
	email: rawEmail,
	role,
	inviterId,
}: {
	orgId: string;
	email: string;
	role: string;
	inviterId: string;
}) => {
	const email = rawEmail.toLowerCase();

	// Check if user is already a member
	const existingUser = await db.query.user.findFirst({
		where: eq(user.email, email),
	});

	if (existingUser) {
		const existingMember = await db.query.member.findFirst({
			where: and(
				eq(member.organizationId, orgId),
				eq(member.userId, existingUser.id),
			),
		});

		if (existingMember) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "User is already a member of this organization",
			});
		}
	}

	// Check for pending invitation
	const existingInvitation = await db.query.invitation.findFirst({
		where: and(
			eq(invitation.organizationId, orgId),
			eq(invitation.email, email),
			eq(invitation.status, "pending"),
		),
	});

	if (existingInvitation) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "An invitation has already been sent to this email",
		});
	}

	// Owner role is non-delegable — no one can invite as owner
	if (role === "owner") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Cannot invite a user with the owner role",
		});
	}

	// If assigning a custom role, verify it exists
	if (!["owner", "admin", "member"].includes(role)) {
		await assertCustomRoleExists(orgId, role, `Role "${role}" not found`);
	}

	const [created] = await db
		.insert(invitation)
		.values({
			id: nanoid(),
			organizationId: orgId,
			email,
			role: role as any,
			status: "pending",
			expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
			inviterId,
		})
		.returning();

	return created;
};

export const findInvitations = async (organizationId: string) => {
	return await db.query.invitation.findMany({
		where: eq(invitation.organizationId, organizationId),
		orderBy: [desc(invitation.status), desc(invitation.expiresAt)],
	});
};

export const removeInvitation = async ({
	invitationId,
	organizationId,
}: {
	invitationId: string;
	organizationId: string;
}) => {
	const invitationResult = await db.query.invitation.findFirst({
		where: eq(invitation.id, invitationId),
	});

	if (!invitationResult) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Invitation not found",
		});
	}

	if (invitationResult?.organizationId !== organizationId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not allowed to remove this invitation",
		});
	}

	const result = await db
		.delete(invitation)
		.where(eq(invitation.id, invitationId));

	return { result, invitationResult };
};

export const updateMemberRole = async ({
	memberId,
	role,
	organizationId,
	currentUserId,
	currentUserRole,
}: {
	memberId: string;
	role: string;
	organizationId: string;
	currentUserId: string;
	currentUserRole: string;
}) => {
	// Fetch the target member
	const target = await db.query.member.findFirst({
		where: eq(member.id, memberId),
		with: { user: true },
	});

	if (!target) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
	}

	if (target.organizationId !== organizationId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not allowed to update this member's role",
		});
	}

	// Prevent users from changing their own role
	if (target.userId === currentUserId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You cannot change your own role",
		});
	}

	// Owner role is nontransferable - cannot change to or from owner
	if (target.role === "owner" || role === "owner") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "The owner role is nontransferable",
		});
	}

	// Only owners can change admin roles
	// Admins can only change member roles
	if (currentUserRole === "admin" && target.role === "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Only the organization owner can change admin roles. Admins can only modify member roles.",
		});
	}

	// If assigning a custom role (not admin/member), verify it exists
	if (role !== "admin" && role !== "member") {
		await assertCustomRoleExists(
			organizationId,
			role,
			`Custom role "${role}" not found`,
		);
	}

	// Update the target member's role
	await db.update(member).set({ role }).where(eq(member.id, memberId));

	return target;
};

export const findActiveOrganization = async (
	activeOrganizationId: string | null | undefined,
) => {
	if (!activeOrganizationId) {
		return null;
	}

	return await db.query.organization.findFirst({
		where: eq(organization.id, activeOrganizationId),
	});
};
