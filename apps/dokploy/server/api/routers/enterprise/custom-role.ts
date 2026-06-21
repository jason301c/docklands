import { statements } from "@dokploy/server/lib/access-control";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const disabled = () =>
	new TRPCError({
		code: "FORBIDDEN",
		message: "Custom roles are not included in Docklands.",
	});

const permissionsSchema = z.record(z.string(), z.array(z.string()));

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

export const customRoleRouter = createTRPCRouter({
	all: protectedProcedure.query((): CustomRoleSummary[] => []),
	create: protectedProcedure
		.input(
			z.object({
				roleName: z.string().min(1),
				permissions: permissionsSchema,
			}),
		)
		.mutation(() => {
			throw disabled();
		}),
	update: protectedProcedure
		.input(
			z.object({
				roleName: z.string().min(1),
				newRoleName: z.string().min(1).optional(),
				permissions: permissionsSchema,
			}),
		)
		.mutation(() => {
			throw disabled();
		}),
	remove: protectedProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.mutation(() => {
			throw disabled();
		}),
	membersByRole: protectedProcedure
		.input(z.object({ roleName: z.string().min(1) }))
		.query((): CustomRoleMember[] => []),
	getStatements: protectedProcedure.query(() => statements),
});
