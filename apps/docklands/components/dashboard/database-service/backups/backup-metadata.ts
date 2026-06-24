import { z } from "zod";
import {
	BACKUP_DATABASE_ENGINE_KEYS,
	type BackupDatabaseEngineKey,
	COMPOSE_BACKUP_METADATA_FIELDS,
	type ComposeBackupMetadataField,
} from "@/shared/database-engines";

/**
 * Shared, registry-driven pieces of the backup/restore compose forms.
 *
 * Both `handle-backup.tsx` and `restore-backup.tsx` collect the same per-engine
 * credentials for a compose backup. Rather than each form hand-writing four
 * parallel `metadata.<engine>` zod objects and a four-branch `superRefine`, both
 * import the shape and refinement from here, so the engine list and required
 * fields cannot drift from the engine registry
 * (`COMPOSE_BACKUP_METADATA_FIELDS`).
 */

export type { BackupDatabaseEngineKey };
/** Engine keys offered in the compose backup/restore "Database Type" select. */
export { BACKUP_DATABASE_ENGINE_KEYS };

/**
 * The per-engine credential objects nested under `metadata`. Each field is a
 * plain `z.string()` and the whole engine object is optional; it only becomes
 * required for compose backups, enforced by {@link refineComposeBackupMetadata}.
 *
 * Spelled out (rather than generated) so the precise per-engine field types
 * survive into the inferred form/tRPC input types. The `satisfies` pins the
 * engine keys to `BackupDatabaseEngineKey`; the field names mirror each engine's
 * `COMPOSE_BACKUP_METADATA_FIELDS` descriptor (the same source the form fields
 * and `refineComposeBackupMetadata` read), so the two stay in step.
 */
export const composeBackupMetadataEngineShape = {
	postgres: z.object({ databaseUser: z.string() }).optional(),
	mysql: z.object({ databaseRootPassword: z.string() }).optional(),
	mariadb: z
		.object({ databaseUser: z.string(), databasePassword: z.string() })
		.optional(),
	mongo: z
		.object({ databaseUser: z.string(), databasePassword: z.string() })
		.optional(),
} satisfies Record<BackupDatabaseEngineKey, z.ZodTypeAny>;

/**
 * Apply the compose-backup credential requirements for the chosen engine. Adds a
 * zod issue for every field the engine needs that is empty, matching the engine
 * registry's dump-command inputs. No-op for engines without compose credentials
 * (e.g. a non-backup engine) so callers can pass any `databaseType`.
 */
export const refineComposeBackupMetadata = (
	databaseType: string | undefined,
	metadata: Record<string, unknown> | undefined,
	ctx: z.RefinementCtx,
) => {
	if (!databaseType) return;
	const fields: readonly ComposeBackupMetadataField[] | undefined =
		COMPOSE_BACKUP_METADATA_FIELDS[databaseType as BackupDatabaseEngineKey];
	if (!fields) return;
	const engineMetadata = metadata?.[databaseType] as
		| Record<string, string>
		| undefined;
	for (const field of fields) {
		if (!engineMetadata?.[field.name]) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: field.requiredMessage,
				path: ["metadata", databaseType, field.name],
			});
		}
	}
};
