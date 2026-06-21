import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";

const disabled = () =>
	new TRPCError({
		code: "FORBIDDEN",
		message: "SSO is not included in Docklands.",
	});

const providerInput = z.object({
	providerId: z.string().min(1).optional(),
	issuer: z.string().min(1).optional(),
	domain: z.string().min(1).optional(),
	oidcConfig: z.string().optional().nullable(),
	samlConfig: z.string().optional().nullable(),
});

export const ssoRouter = createTRPCRouter({
	showSignInWithSSO: publicProcedure.query(() => false),
	enforceSSO: publicProcedure.query(() => false),
	listProviders: protectedProcedure.query(() => []),
	getTrustedOrigins: protectedProcedure.query(() => []),
	one: protectedProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.query(() => null),
	update: protectedProcedure.input(providerInput).mutation(() => {
		throw disabled();
	}),
	deleteProvider: protectedProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.mutation(() => {
			throw disabled();
		}),
	register: protectedProcedure.input(providerInput).mutation(() => {
		throw disabled();
	}),
	addTrustedOrigin: protectedProcedure
		.input(z.object({ origin: z.string().min(1) }))
		.mutation(() => {
			throw disabled();
		}),
	removeTrustedOrigin: protectedProcedure
		.input(z.object({ origin: z.string().min(1) }))
		.mutation(() => {
			throw disabled();
		}),
	updateTrustedOrigin: protectedProcedure
		.input(
			z.object({
				oldOrigin: z.string().min(1),
				newOrigin: z.string().min(1),
			}),
		)
		.mutation(() => {
			throw disabled();
		}),
});
