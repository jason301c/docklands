import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import {
	type apiCreateRuntimeWorker,
	organization,
	runtimeWorkers,
} from "@/server/core/db/schema";
import { getMemberResourceAccessSet } from "./permission";

export type RuntimeWorker = typeof runtimeWorkers.$inferSelect;

export const createRuntimeWorker = async (
	input: z.infer<typeof apiCreateRuntimeWorker>,
	organizationId: string,
) => {
	const runtimeWorker = await db
		.insert(runtimeWorkers)
		.values({
			...input,
			organizationId: organizationId,
			createdAt: new Date().toISOString(),
		} as typeof runtimeWorkers.$inferInsert)
		.returning()
		.then((value) => value[0]);

	if (!runtimeWorker) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the runtime worker",
		});
	}

	return runtimeWorker;
};

export const findRuntimeWorkerById = async (runtimeWorkerId: string) => {
	const runtimeWorker = await db.query.runtimeWorkers.findFirst({
		where: eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId),
		with: {
			deployments: true,
			sshKey: true,
		},
	});
	if (!runtimeWorker) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Runtime worker not found",
		});
	}
	return runtimeWorker;
};

export const findRuntimeWorkersByUserId = async (userId: string) => {
	const orgs = await db.query.organization.findMany({
		where: eq(organization.ownerId, userId),
		with: {
			runtimeWorkers: true,
		},
	});

	const runtimeWorkers = orgs.flatMap((org) => org.runtimeWorkers);

	return runtimeWorkers;
};

export const deleteRuntimeWorker = async (runtimeWorkerId: string) => {
	const runtimeWorker = await db
		.delete(runtimeWorkers)
		.where(eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId))
		.returning()
		.then((value) => value[0]);

	return runtimeWorker;
};

export const haveActiveServices = async (runtimeWorkerId: string) => {
	const runtimeWorker = await db.query.runtimeWorkers.findFirst({
		where: eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId),
		with: {
			applications: true,
			compose: true,
			libsql: true,
			mariadb: true,
			mongo: true,
			mysql: true,
			postgres: true,
			redis: true,
		},
	});

	if (!runtimeWorker) {
		return false;
	}

	const total =
		runtimeWorker?.applications?.length +
		runtimeWorker?.compose?.length +
		runtimeWorker?.libsql?.length +
		runtimeWorker?.mariadb?.length +
		runtimeWorker?.mongo?.length +
		runtimeWorker?.mysql?.length +
		runtimeWorker?.postgres?.length +
		runtimeWorker?.redis?.length;

	if (total === 0) {
		return false;
	}

	return true;
};

export const updateRuntimeWorkerById = async (
	runtimeWorkerId: string,
	runtimeWorkerData: Partial<RuntimeWorker>,
) => {
	const result = await db
		.update(runtimeWorkers)
		.set({
			...runtimeWorkerData,
		})
		.where(eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId))
		.returning()
		.then((res) => res[0]);

	return result;
};

export const getAllRuntimeWorkers = async () => {
	const workers = await db.query.runtimeWorkers.findMany();
	return workers;
};

export const getAccessibleRuntimeWorkerIds = async (session: {
	userId: string;
	activeOrganizationId: string;
}): Promise<Set<string>> => {
	const { userId, activeOrganizationId } = session;

	const allOrgRuntimeWorkers = await db.query.runtimeWorkers.findMany({
		where: eq(runtimeWorkers.organizationId, activeOrganizationId),
		columns: {
			runtimeWorkerId: true,
		},
	});

	const { role, ids } = await getMemberResourceAccessSet(
		userId,
		activeOrganizationId,
		"runtimeWorker",
	);

	if (role === "owner" || role === "admin") {
		return new Set(
			allOrgRuntimeWorkers.map((worker) => worker.runtimeWorkerId),
		);
	}

	return ids;
};
