import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { type apiCreatePort, ports } from "@/server/core/db/schema";

export type Port = typeof ports.$inferSelect;

export const createPort = async (input: z.infer<typeof apiCreatePort>) => {
	const newPort = await db
		.insert(ports)
		.values({
			...input,
		})
		.returning()
		.then((value) => value[0]);

	if (!newPort) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting port",
		});
	}

	return newPort;
};

export const finPortById = async (portId: string) => {
	return orThrowNotFound(
		db.query.ports.findFirst({
			where: eq(ports.portId, portId),
			with: {
				application: {
					with: {
						environment: {
							with: {
								workspace: true,
							},
						},
					},
				},
			},
		}),
		"Port",
	);
};

export const removePortById = async (portId: string) => {
	const result = await db
		.delete(ports)
		.where(eq(ports.portId, portId))
		.returning();

	return result[0];
};

export const updatePortById = async (
	portId: string,
	portData: Partial<Port>,
) => {
	const result = await db
		.update(ports)
		.set({
			...portData,
		})
		.where(eq(ports.portId, portId))
		.returning();

	return result[0];
};
