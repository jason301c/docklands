import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { member, organizationRole } from "@/server/core/db/schema";

const RESERVED_ROLES = new Set(["owner", "admin", "member"]);

export type CustomRoleSummary = {
	role: string;
	permissions: Record<string, string[]>;
	createdAt: Date;
	ids: string[];
	memberCount: number;
};

export type CustomRoleMember = {
	id: string;
	userId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
};

export const assertNotReserved = (roleName: string) => {
	if (RESERVED_ROLES.has(roleName.trim().toLowerCase())) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `"${roleName}" is a built-in role and cannot be managed as a custom role.`,
		});
	}
};

/**
 * Aggregate the `organization_role` rows for an org into one summary per role.
 * Duplicate rows for the same role name are deduped: their ids are collected,
 * the earliest `createdAt` wins, and their JSON permission maps are merge-folded
 * (per-resource action lists are unioned). Member counts come from the `member`
 * table. This logic is moved verbatim from the router and must stay identical.
 */
export const aggregateCustomRoles = async (
	organizationId: string,
): Promise<CustomRoleSummary[]> => {
	const rows = await db.query.organizationRole.findMany({
		where: eq(organizationRole.organizationId, organizationId),
	});

	const byRole = new Map<
		string,
		{
			ids: string[];
			permissions: Record<string, string[]>;
			createdAt: Date;
		}
	>();
	for (const row of rows) {
		const entry = byRole.get(row.role) ?? {
			ids: [],
			permissions: {},
			createdAt: row.createdAt,
		};
		entry.ids.push(row.id);
		if (row.createdAt < entry.createdAt) {
			entry.createdAt = row.createdAt;
		}
		const parsed = JSON.parse(row.permission) as Record<string, string[]>;
		for (const [resource, actions] of Object.entries(parsed)) {
			entry.permissions[resource] = [
				...new Set([...(entry.permissions[resource] ?? []), ...actions]),
			];
		}
		byRole.set(row.role, entry);
	}

	const members = await db.query.member.findMany({
		where: eq(member.organizationId, organizationId),
		columns: { role: true },
	});
	const memberCounts = new Map<string, number>();
	for (const m of members) {
		memberCounts.set(m.role, (memberCounts.get(m.role) ?? 0) + 1);
	}

	return [...byRole.entries()].map(([role, entry]) => ({
		role,
		permissions: entry.permissions,
		createdAt: entry.createdAt,
		ids: entry.ids,
		memberCount: memberCounts.get(role) ?? 0,
	}));
};

export const createCustomRole = async ({
	organizationId,
	roleName,
	permissions,
}: {
	organizationId: string;
	roleName: string;
	permissions: Record<string, string[]>;
}) => {
	assertNotReserved(roleName);

	const existing = await db.query.organizationRole.findFirst({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, roleName),
		),
	});
	if (existing) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `A role named "${roleName}" already exists.`,
		});
	}

	await db.insert(organizationRole).values({
		organizationId,
		role: roleName,
		permission: JSON.stringify(permissions),
	});
	return true;
};

export const updateCustomRole = async ({
	organizationId,
	roleName,
	newRoleName,
	permissions,
}: {
	organizationId: string;
	roleName: string;
	newRoleName?: string;
	permissions: Record<string, string[]>;
}) => {
	assertNotReserved(roleName);

	const rows = await db.query.organizationRole.findMany({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, roleName),
		),
	});
	if (rows.length === 0) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Role "${roleName}" was not found.`,
		});
	}

	const targetName = newRoleName ?? roleName;
	const renaming = targetName !== roleName;
	if (renaming) {
		assertNotReserved(targetName);
		const collision = await db.query.organizationRole.findFirst({
			where: and(
				eq(organizationRole.organizationId, organizationId),
				eq(organizationRole.role, targetName),
			),
		});
		if (collision) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `A role named "${targetName}" already exists.`,
			});
		}
	}

	await db.transaction(async (tx) => {
		// Collapse any duplicate rows for this role into a single canonical row.
		await tx
			.delete(organizationRole)
			.where(
				and(
					eq(organizationRole.organizationId, organizationId),
					eq(organizationRole.role, roleName),
				),
			);
		await tx.insert(organizationRole).values({
			organizationId,
			role: targetName,
			permission: JSON.stringify(permissions),
		});
		if (renaming) {
			await tx
				.update(member)
				.set({ role: targetName })
				.where(
					and(
						eq(member.organizationId, organizationId),
						eq(member.role, roleName),
					),
				);
		}
	});
	return true;
};

export const removeCustomRole = async ({
	organizationId,
	roleName,
}: {
	organizationId: string;
	roleName: string;
}) => {
	assertNotReserved(roleName);

	await db.transaction(async (tx) => {
		await tx
			.delete(organizationRole)
			.where(
				and(
					eq(organizationRole.organizationId, organizationId),
					eq(organizationRole.role, roleName),
				),
			);
		// Demote any members still holding the removed role to the base member role.
		await tx
			.update(member)
			.set({ role: "member" })
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.role, roleName),
				),
			);
	});
	return true;
};

export const findMembersByRole = async ({
	organizationId,
	roleName,
}: {
	organizationId: string;
	roleName: string;
}): Promise<CustomRoleMember[]> => {
	const members = await db.query.member.findMany({
		where: and(
			eq(member.organizationId, organizationId),
			eq(member.role, roleName),
		),
		with: { user: true },
	});
	return members.map((m) => ({
		id: m.id,
		userId: m.userId,
		email: m.user.email,
		firstName: m.user.firstName,
		lastName: m.user.lastName,
	}));
};
