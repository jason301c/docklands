import type { RouterOutputs } from "@/client/api/trpc";

/**
 * Browser-side views of each engine's `config` jsonb. The tRPC `database.one`
 * output types `config` as the *union* of all engine configs (it is not a
 * discriminated union keyed on `engine`), so switching on `engine` does not
 * narrow `config` on its own. These helpers do the per-engine narrowing in one
 * place, keeping client components free of `server/` imports.
 */
type DatabaseConfig = RouterOutputs["database"]["one"]["config"];

export interface PostgresFields {
	databaseName: string;
	databaseUser: string;
	databasePassword: string;
}

export interface MysqlFields extends PostgresFields {
	databaseRootPassword: string;
}

export interface MongoFields {
	databaseUser: string;
	databasePassword: string;
	replicaSets: boolean;
}

export interface RedisFields {
	databasePassword: string;
}

export interface LibsqlFields {
	databaseUser: string;
	databasePassword: string;
	sqldNode: "primary" | "replica";
	sqldPrimaryUrl?: string;
	enableNamespaces: boolean;
	externalGRPCPort?: number;
	externalAdminPort?: number;
}

/**
 * Cast the union `config` to the fields for a known engine. Safe at call sites
 * already guarded by the matching `engine` discriminator.
 */
export const asPostgres = (config: DatabaseConfig) =>
	config as unknown as PostgresFields;
export const asMysql = (config: DatabaseConfig) =>
	config as unknown as MysqlFields;
export const asMongo = (config: DatabaseConfig) =>
	config as unknown as MongoFields;
export const asRedis = (config: DatabaseConfig) =>
	config as unknown as RedisFields;
export const asLibsql = (config: DatabaseConfig) =>
	config as unknown as LibsqlFields;
