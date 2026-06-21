import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "../../trpc";

const disabled = () =>
	new TRPCError({
		code: "FORBIDDEN",
		message: "Application SSO authentication is not included in Docklands.",
	});

const serverTarget = z.object({ serverId: z.string().optional().nullable() });
const domainTarget = z.object({ domainId: z.string().min(1) });

export const forwardAuthRouter = createTRPCRouter({
	getAuthDomain: protectedProcedure.input(serverTarget).query(() => null),
	setAuthDomain: protectedProcedure.input(z.any()).mutation(() => {
		throw disabled();
	}),
	removeAuthDomain: protectedProcedure.input(serverTarget).mutation(() => {
		throw disabled();
	}),
	listProviders: protectedProcedure.query(() => []),
	serverStatus: protectedProcedure.query(() => []),
	deployOnServer: protectedProcedure.input(z.any()).mutation(() => {
		throw disabled();
	}),
	removeOnServer: protectedProcedure.input(serverTarget).mutation(() => {
		throw disabled();
	}),
	status: withPermission("domain", "read")
		.input(domainTarget)
		.query(() => ({ enabled: false })),
	enable: withPermission("domain", "create")
		.input(domainTarget)
		.mutation(() => {
			throw disabled();
		}),
	disable: withPermission("domain", "create")
		.input(domainTarget)
		.mutation(() => {
			throw disabled();
		}),
});
