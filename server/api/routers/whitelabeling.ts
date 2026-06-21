import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const disabled = () =>
	new TRPCError({
		code: "FORBIDDEN",
		message: "Whitelabeling is not included in Docklands.",
	});

type WhitelabelingConfig = {
	appName: string | null;
	appDescription: string | null;
	logoUrl: string | null;
	faviconUrl: string | null;
	customCss: string | null;
	loginLogoUrl: string | null;
	supportUrl: string | null;
	docsUrl: string | null;
	errorPageTitle: string | null;
	errorPageDescription: string | null;
	metaTitle: string | null;
	footerText: string | null;
};

export const whitelabelingRouter = createTRPCRouter({
	get: protectedProcedure.query((): WhitelabelingConfig | null => null),
	getPublic: publicProcedure.query((): WhitelabelingConfig | null => null),
	update: protectedProcedure.input(z.any()).mutation(() => {
		throw disabled();
	}),
	reset: protectedProcedure.mutation(() => {
		throw disabled();
	}),
});
