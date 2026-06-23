import { join, resolve, sep } from "node:path";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { paths } from "@/server/core/constants/paths";
import { db } from "@/server/core/db";
import { orThrowNotFound } from "@/server/core/db/find-or-throw";
import { type apiCreatePatch, patch } from "@/server/core/db/schema";
import { encodeBase64 } from "../utils/docker/utils";
import { findApplicationById } from "./application";
import { findComposeById } from "./compose";

export type Patch = typeof patch.$inferSelect;

export const createPatch = async (input: z.infer<typeof apiCreatePatch>) => {
	if (!input.applicationId && !input.composeId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Either applicationId or composeId must be provided",
		});
	}

	const newPatch = await db
		.insert(patch)
		.values({
			...input,
			content: input.content,
			enabled: true,
		})
		.returning()
		.then((value) => value[0]);

	if (!newPatch) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the patch",
		});
	}

	return newPatch;
};

export const findPatchById = async (patchId: string) => {
	return orThrowNotFound(
		db.query.patch.findFirst({
			where: eq(patch.patchId, patchId),
		}),
		"Patch",
	);
};

export const findPatchesByEntityId = async (
	id: string,
	type: "application" | "compose",
) => {
	return await db.query.patch.findMany({
		where: eq(
			type === "application" ? patch.applicationId : patch.composeId,
			id,
		),
		orderBy: (patch, { asc }) => [asc(patch.filePath)],
	});
};

export const findPatchByFilePath = async (
	filePath: string,
	id: string,
	type: "application" | "compose",
) => {
	return await db.query.patch.findFirst({
		where: and(
			eq(patch.filePath, filePath),
			eq(type === "application" ? patch.applicationId : patch.composeId, id),
		),
	});
};

export const updatePatch = async (patchId: string, data: Partial<Patch>) => {
	const result = await db
		.update(patch)
		.set({
			...data,
			...(data.content && {
				content: data.content.endsWith("\n")
					? data.content
					: `${data.content}\n`,
			}),
			updatedAt: new Date().toISOString(),
		})
		.where(eq(patch.patchId, patchId))
		.returning();

	return result[0];
};

export const deletePatch = async (patchId: string) => {
	const result = await db
		.delete(patch)
		.where(eq(patch.patchId, patchId))
		.returning();

	return result[0];
};

export const markPatchForDeletion = async (
	filePath: string,
	entityId: string,
	entityType: "application" | "compose",
) => {
	const existing = await findPatchByFilePath(filePath, entityId, entityType);

	if (existing) {
		return await updatePatch(existing.patchId, { type: "delete", content: "" });
	}

	return await createPatch({
		filePath,
		content: "",
		type: "delete",
		applicationId: entityType === "application" ? entityId : undefined,
		composeId: entityType === "compose" ? entityId : undefined,
	});
};

interface ApplyPatchesOptions {
	id: string;
	type: "application" | "compose";
	runtimeWorkerId: string | null;
}

export const generateApplyPatchesCommand = async ({
	id,
	type,
	runtimeWorkerId,
}: ApplyPatchesOptions) => {
	const entity =
		type === "application"
			? await findApplicationById(id)
			: await findComposeById(id);
	const { COMPOSE_PATH, APPLICATIONS_PATH } = paths(!!runtimeWorkerId);
	const basePath = type === "compose" ? COMPOSE_PATH : APPLICATIONS_PATH;
	const codePath = join(basePath, entity.appName, "code");

	const resultPatches = await findPatchesByEntityId(id, type);
	const patches = resultPatches.filter((p) => p.enabled);

	if (patches.length === 0) {
		return "";
	}

	let command = `echo "Applying ${patches.length} patch(es)...";`;

	const codeRoot = resolve(codePath);
	for (const p of patches) {
		const filePath = join(codePath, p.filePath);

		// Containment: a patch must not escape the cloned code directory (a
		// `../` path would otherwise let it write/delete arbitrary files on the
		// worker).
		const resolved = resolve(filePath);
		if (resolved !== codeRoot && !resolved.startsWith(codeRoot + sep)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Patch path escapes the repository: ${p.filePath}`,
			});
		}

		// base64-encode the path so its bytes never reach the shell raw (a path
		// with quotes / `$` / backticks used to break out of the quoting and
		// execute on the build worker). Decode into a quoted shell variable.
		const fileB64 = encodeBase64(filePath);
		if (p.type === "delete") {
			command += `
			file="$(echo "${fileB64}" | base64 -d)"
			rm -f "$file";
			`;
		} else {
			command += `
file="$(echo "${fileB64}" | base64 -d)"
dir="$(dirname "$file")"
mkdir -p "$dir"
echo "${encodeBase64(p.content)}" | base64 -d > "$file"
`;
		}
	}

	return command;
};
