import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/core/db";
import { member, organizationRole } from "@/server/core/db/schema";
import { statements } from "@/server/core/lib/access-control";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "../trpc";

const RESERVED_ROLES = new Set(["owner", "admin", "member"]);

const statementsByResource = statements as Record<string, readonly string[]>;

/**
 * Permissions are validated against the canonical access-control statements so a
 * custom role can never be created with an unknown resource/action. This keeps
 * `organization_role.permission` consistent with what `resolveRole` can authorize.
 */
const permissionsSchema = z
	.record(z.string(), z.array(z.string()))
	.superRefine((perms, ctx) => {
		for (const [resource, actions] of Object.entries(perms)) {
			const allowed = statementsByResource[resource];
			if (!allowed) {
				ctx.addIssue({
					code: "custom",
					message: `Unknown permission resource: ${resource}`,
				});
				continue;
			}
			for (const action of actions) {
				if (!allowed.includes(action)) {
					ctx.addIssue({
						code: "custom",
						message: `Unknown action "${action}" for resource "${resource}"`,
					});
				}
			}
		}
	});

type CustomRoleSummary = {
	role: string;
	permissions: Record<string, string[]>;
	createdAt: Date;
	ids: string[];
	memberCount: number;
};

type CustomRoleMember = {
	id: string;
	userId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
};

const assertNotReserved = (roleName: string) => {
	if (RESERVED_ROLES.has(roleName.trim().toLowerCase())) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `"${roleName}" is a built-in role and cannot be managed as a custom role.`,
		});
	}
};

export const customRoleRouter = createTRPCRouter({
	all: protectedProcedure.query(
		async ({ ctx }): Promise<CustomRoleSummary[]> => {
			const organizationId = ctx.session.activeOrganizationId;
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
		},
	),
	create: adminProcedure
		.input(
			z.object({
				roleName: z.string().min(1),
				permissions: permissionsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			assertNotReserved(input.roleName);

			const existing = await db.query.organizationRole.findFirst({
				where: and(
					eq(organizationRole.organizationId, organizationId),
					eq(organizationRole.role, input.roleName),
				),
			});
			if (existing) {
				throw new TRPCError({
					code: "CONFLICT",
					message: `A role named "${input.roleName}" already exists.`,
				});
			}

			await db.insert(organizationRole).values({
				organizationId,
				role: input.roleName,
				permission: JSON.stringify(input.permissions),
			});
			return true;
		}),
	update: adminProcedure
		.input(
			z.object({
				roleName: z.string().min(1),
				newRoleName: z.string().min(1).optional(),
				permissions: permissionsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			assertNotReserved(input.roleName);

			const rows = await db.query.organizationRole.findMany({
				where: and(
					eq(organizationRole.organizationId, organizationId),
					eq(organizationRole.role, input.roleName),
				),
			});
			if (rows.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Role "${input.roleName}" was not found.`,
				});
			}

			const targetName = input.newRoleName ?? input.roleName;
			const renaming = targetName !== input.roleName;
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
							eq(organizationRole.role, input.roleName),
						),
					);
				await tx.insert(organizationRole).values({
					organizationId,
					role: targetName,
					permission: JSON.stringify(input.permissions),
				});
				if (renaming) {
					await tx
						.update(member)
						.set({ role: targetName })
						.where(
							and(
								eq(member.organizationId, organizationId),
								eq(member.role, input.roleName),
							),
						);
				}
			});
			return true;
		}),
	remove: adminProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			assertNotReserved(input.roleName);

			await db.transaction(async (tx) => {
				await tx
					.delete(organizationRole)
					.where(
						and(
							eq(organizationRole.organizationId, organizationId),
							eq(organizationRole.role, input.roleName),
						),
					);
				// Demote any members still holding the removed role to the base member role.
				await tx
					.update(member)
					.set({ role: "member" })
					.where(
						and(
							eq(member.organizationId, organizationId),
							eq(member.role, input.roleName),
						),
					);
			});
			return true;
		}),
	membersByRole: adminProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.query(async ({ ctx, input }): Promise<CustomRoleMember[]> => {
			const organizationId = ctx.session.activeOrganizationId;
			const members = await db.query.member.findMany({
				where: and(
					eq(member.organizationId, organizationId),
					eq(member.role, input.roleName),
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
		}),
	getStatements: protectedProcedure.query(() => statements),
});
