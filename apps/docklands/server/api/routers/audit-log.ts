import { z } from "zod";
import type { AuditAction, AuditResourceType } from "@/server/core/db/schema";
import { getAuditLogs } from "@/server/core/services/audit-log";
import { createTRPCRouter, withPermission } from "../trpc";

export const auditLogRouter = createTRPCRouter({
	all: withPermission("auditLog", "read")
		.input(
			z.object({
				userId: z.string().optional(),
				userEmail: z.string().optional(),
				resourceName: z.string().optional(),
				action: z.string().optional(),
				resourceType: z.string().optional(),
				from: z.date().optional(),
				to: z.date().optional(),
				limit: z.number().min(1).max(500).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(({ input, ctx }) =>
			getAuditLogs({
				organizationId: ctx.session.activeOrganizationId,
				userId: input.userId,
				userEmail: input.userEmail,
				resourceName: input.resourceName,
				action: input.action as AuditAction | undefined,
				resourceType: input.resourceType as AuditResourceType | undefined,
				from: input.from,
				to: input.to,
				limit: input.limit,
				offset: input.offset,
			}),
		),
});
