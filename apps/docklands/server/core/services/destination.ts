import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import {
	type apiCreateDestination,
	destinations,
} from "@/server/core/db/schema";

export type Destination = typeof destinations.$inferSelect;

export const createDestination = async (
	input: z.infer<typeof apiCreateDestination>,
	organizationId: string,
) => {
	const newDestination = await db
		.insert(destinations)
		.values({
			...input,
			organizationId: organizationId,
		})
		.returning()
		.then((value) => value[0]);

	if (!newDestination) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting destination",
		});
	}

	return newDestination;
};

export const findDestinationById = async (destinationId: string) => {
	return orThrowNotFound(
		db.query.destinations.findFirst({
			where: and(eq(destinations.destinationId, destinationId)),
		}),
		"Destination",
	);
};

export const removeDestinationById = async (
	destinationId: string,
	organizationId: string,
) => {
	const result = await db
		.delete(destinations)
		.where(
			and(
				eq(destinations.destinationId, destinationId),
				eq(destinations.organizationId, organizationId),
			),
		)
		.returning();

	return result[0];
};

export const updateDestinationById = async (
	destinationId: string,
	destinationData: Partial<Destination>,
) => {
	const { accessKey, secretAccessKey, ...rest } = destinationData;
	const result = await db
		.update(destinations)
		.set({
			...rest,
			// Blank credential fields mean "keep existing" — an update that doesn't
			// resend the S3 keys (e.g. changing only the name/region) must not wipe
			// them and silently break every backup to this destination.
			...(accessKey ? { accessKey } : {}),
			...(secretAccessKey ? { secretAccessKey } : {}),
		})
		.where(
			and(
				eq(destinations.destinationId, destinationId),
				eq(destinations.organizationId, destinationData.organizationId || ""),
			),
		)
		.returning();

	return result[0];
};
