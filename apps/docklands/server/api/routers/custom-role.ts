import { z } from "zod";
import { statements } from "@/server/core/lib/access-control";
import {
	aggregateCustomRoles,
	type CustomRoleMember,
	type CustomRoleSummary,
	createCustomRole,
	findMembersByRole,
	removeCustomRole,
	updateCustomRole,
} from "@/server/core/services/custom-role";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "../trpc";

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

export const customRoleRouter = createTRPCRouter({
	all: protectedProcedure.query(
		async ({ ctx }): Promise<CustomRoleSummary[]> => {
			return aggregateCustomRoles(ctx.session.activeOrganizationId);
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
			return createCustomRole({
				organizationId: ctx.session.activeOrganizationId,
				roleName: input.roleName,
				permissions: input.permissions,
			});
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
			return updateCustomRole({
				organizationId: ctx.session.activeOrganizationId,
				roleName: input.roleName,
				newRoleName: input.newRoleName,
				permissions: input.permissions,
			});
		}),
	remove: adminProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			return removeCustomRole({
				organizationId: ctx.session.activeOrganizationId,
				roleName: input.roleName,
			});
		}),
	membersByRole: adminProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.query(async ({ ctx, input }): Promise<CustomRoleMember[]> => {
			return findMembersByRole({
				organizationId: ctx.session.activeOrganizationId,
				roleName: input.roleName,
			});
		}),
	getStatements: protectedProcedure.query(() => statements),
});
