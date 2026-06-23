import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { type apiCreateRegistry, registry } from "@/server/core/db/schema";
import {
	execAsync,
	execAsyncRemote,
} from "@/server/core/utils/process/execAsync";

export type Registry = typeof registry.$inferSelect;

function shEscape(s: string | undefined): string {
	if (!s) return "''";
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function safeDockerLoginCommand(
	registry: string | undefined,
	user: string | undefined,
	pass: string | undefined,
) {
	const escapedRegistry = shEscape(registry);
	const escapedUser = shEscape(user);
	const escapedPassword = shEscape(pass);
	return `printf %s ${escapedPassword} | docker login ${escapedRegistry} -u ${escapedUser} --password-stdin`;
}

function sanitizeRegistryError(
	error: unknown,
	password: string | null | undefined,
): string {
	const message =
		error instanceof Error ? error.message : "Error with registry login";
	if (!password) return message;
	return message.split(password).join("***");
}

export const createRegistry = async (
	input: z.infer<typeof apiCreateRegistry>,
	organizationId: string,
) => {
	return await db.transaction(async (tx) => {
		const newRegistry = await tx
			.insert(registry)
			.values({
				...input,
				organizationId: organizationId,
			})
			.returning()
			.then((value) => value[0]);

		if (!newRegistry) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Error input:  Inserting registry",
			});
		}

		const loginCommand = safeDockerLoginCommand(
			input.registryUrl,
			input.username,
			input.password,
		);
		try {
			if (input.runtimeWorkerId && input.runtimeWorkerId !== "none") {
				await execAsyncRemote(input.runtimeWorkerId, loginCommand);
			} else if (newRegistry.registryType === "cloud") {
				await execAsync(loginCommand);
			}
		} catch (error) {
			const sanitized = sanitizeRegistryError(error, input.password);
			throw new TRPCError({ code: "BAD_REQUEST", message: sanitized });
		}

		return newRegistry;
	});
};

export const removeRegistry = async (registryId: string) => {
	try {
		const response = await db
			.delete(registry)
			.where(eq(registry.registryId, registryId))
			.returning()
			.then((res) => res[0]);

		if (!response) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Registry not found",
			});
		}

		await execAsync(`docker logout ${shEscape(response.registryUrl)}`);

		return response;
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error removing this registry",
			cause: error,
		});
	}
};

export const updateRegistry = async (
	registryId: string,
	registryData: Partial<Registry> & { runtimeWorkerId?: string | null },
) => {
	try {
		const response = await db
			.update(registry)
			.set({
				...registryData,
			})
			.where(eq(registry.registryId, registryId))
			.returning()
			.then((res) => res[0]);

		// NEVER log loginCommand — contains registry password
		const loginCommand = safeDockerLoginCommand(
			response?.registryUrl,
			response?.username,
			response?.password,
		);

		try {
			if (
				registryData?.runtimeWorkerId &&
				registryData?.runtimeWorkerId !== "none"
			) {
				await execAsyncRemote(registryData.runtimeWorkerId, loginCommand);
			} else if (response?.registryType === "cloud") {
				await execAsync(loginCommand);
			}
		} catch (execError) {
			throw new Error(sanitizeRegistryError(execError, response?.password));
		}

		return response;
	} catch (error) {
		const message =
			error instanceof TRPCError
				? error.message
				: error instanceof Error
					? error.message
					: "Error updating this registry";
		throw new TRPCError({
			code: "BAD_REQUEST",
			message,
		});
	}
};

export const findRegistryById = async (registryId: string) => {
	return orThrowNotFound(
		db.query.registry.findFirst({
			where: eq(registry.registryId, registryId),
			columns: {
				password: false,
			},
		}),
		"Registry",
	);
};

export const findRegistryByIdWithCredentials = async (registryId: string) => {
	return orThrowNotFound(
		db.query.registry.findFirst({
			where: eq(registry.registryId, registryId),
		}),
		"Registry",
	);
};

export const findAllRegistryByOrganizationId = async (
	organizationId: string,
) => {
	const registryResponse = await db.query.registry.findMany({
		where: eq(registry.organizationId, organizationId),
	});
	return registryResponse;
};
