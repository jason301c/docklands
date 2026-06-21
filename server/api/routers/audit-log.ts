import { z } from "zod";
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
		.query(() => {
			return { logs: [], total: 0 };
		}),
});
