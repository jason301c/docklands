import { DATABASE_ENGINE_METADATA } from "@/shared/database-engines";
import {
	WORKSPACE_VARIABLE_SOURCE_TYPES,
	type WorkspaceVariableSourceType,
} from "@/shared/workspace-graph";

/**
 * Browser-side display labels for each managed database engine, derived from
 * shared engine metadata so client components do not import from `server/`.
 */
export const ENGINE_LABELS = Object.fromEntries(
	WORKSPACE_VARIABLE_SOURCE_TYPES.map((engine) => [
		engine,
		DATABASE_ENGINE_METADATA[engine].label,
	]),
) as Record<WorkspaceVariableSourceType, string>;
