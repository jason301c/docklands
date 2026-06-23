import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/server/api/utils/audit";
import {
	findActiveOrganization,
	findInvitations,
	inviteMember,
	removeInvitation,
	updateMemberRole,
	updateOrganization,
} from "@/server/core/services/organization";
import { createTRPCRouter, protectedProcedure, withPermission } from "../trpc";

// Docklands is single-tenant: every instance has exactly one organization,
// created when the first user registers (see `server/core/lib/auth.ts`). There
// is no way to create, switch, or delete organizations — the org is the
// instance's identity and the container for its members, roles, and invitations.
// This router only exposes reading the active org, editing its name/logo, and
// managing its members and invitations.
export const organizationRouter = createTRPCRouter({
	update: withPermission("organization", "update")
		.input(
			z.object({
				name: z.string().min(1, "Name is required"),
				logo: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const organizationId = ctx.session.activeOrganizationId;
			if (!organizationId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No active organization",
				});
			}

			const result = await updateOrganization({
				organizationId,
				name: input.name,
				logo: input.logo,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "organization",
				resourceId: organizationId,
				resourceName: input.name,
			});
			return result;
		}),
	inviteMember: withPermission("member", "create")
		.input(
			z.object({
				email: z.string().email(),
				role: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const created = await inviteMember({
				orgId: ctx.session.activeOrganizationId,
				email: input.email,
				role: input.role,
				inviterId: ctx.user.id,
			});

			await audit(ctx, {
				action: "create",
				resourceType: "organization",
				resourceId: created?.id,
				resourceName: input.email.toLowerCase(),
				metadata: { type: "inviteMember", role: input.role },
			});
			return created;
		}),

	allInvitations: withPermission("member", "create").query(async ({ ctx }) => {
		return findInvitations(ctx.session.activeOrganizationId);
	}),
	removeInvitation: withPermission("member", "create")
		.input(z.object({ invitationId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { result, invitationResult } = await removeInvitation({
				invitationId: input.invitationId,
				organizationId: ctx.session.activeOrganizationId,
			});
			await audit(ctx, {
				action: "delete",
				resourceType: "organization",
				resourceId: input.invitationId,
				resourceName: invitationResult.email,
				metadata: { type: "removeInvitation" },
			});
			return result;
		}),
	updateMemberRole: withPermission("member", "update")
		.input(
			z.object({
				memberId: z.string(),
				role: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const target = await updateMemberRole({
				memberId: input.memberId,
				role: input.role,
				organizationId: ctx.session.activeOrganizationId,
				currentUserId: ctx.user.id,
				currentUserRole: ctx.user.role,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "user",
				resourceId: target.userId,
				resourceName: target.user.email,
				metadata: { before: target.role, after: input.role },
			});
			return true;
		}),
	active: protectedProcedure.query(async ({ ctx }) => {
		return findActiveOrganization(ctx.session.activeOrganizationId);
	}),
});
