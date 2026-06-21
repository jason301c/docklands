import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
} from "@/server/api/trpc";

const disabled = () =>
	new TRPCError({
		code: "FORBIDDEN",
		message: "Commercial license features are not included in Docklands.",
	});

export const licenseKeyRouter = createTRPCRouter({
	activate: adminProcedure
		.input(z.object({ licenseKey: z.string().min(1) }))
		.mutation(() => {
			throw disabled();
		}),
	validate: adminProcedure.mutation(() => {
		throw disabled();
	}),
	deactivate: adminProcedure.mutation(() => {
		throw disabled();
	}),
	getEnterpriseSettings: adminProcedure.query(() => {
		return {
			enableEnterpriseFeatures: false,
			licenseKey: "",
		};
	}),
	haveValidLicenseKey: protectedProcedure.query(() => {
		return false;
	}),
	updateEnterpriseSettings: adminProcedure
		.input(z.object({ enableEnterpriseFeatures: z.boolean().optional() }))
		.mutation(() => {
			throw disabled();
		}),
});
