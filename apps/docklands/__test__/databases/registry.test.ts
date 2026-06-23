import { describe, expect, it } from "vitest";
import {
	DATABASE_ENGINE_KEYS,
	DatabaseCredentialExtractionError,
	databaseBackupCommand,
	databaseChangePasswordCommand,
	databaseEngines,
	extractDatabaseCredentials,
	getDatabaseEngine,
	parseDatabaseConfig,
	UnsafeDatabaseShellValueError,
} from "@/server/core/databases/registry";

describe("database engine registry", () => {
	it("exposes a descriptor for every engine key", () => {
		for (const key of DATABASE_ENGINE_KEYS) {
			expect(databaseEngines[key].key).toBe(key);
		}
	});

	describe("buildDefaultEnv reproduces the legacy builder output", () => {
		it("postgres", () => {
			const env = getDatabaseEngine("postgres").buildDefaultEnv(
				{
					databaseName: "app",
					databaseUser: "admin",
					databasePassword: "secret",
				},
				"FOO=bar",
			);
			expect(env).toBe(
				'POSTGRES_DB="app"\nPOSTGRES_USER="admin"\nPOSTGRES_PASSWORD="secret"\nFOO=bar',
			);
		});

		it("mysql with a non-root user includes MYSQL_USER", () => {
			const env = getDatabaseEngine("mysql").buildDefaultEnv(
				{
					databaseName: "app",
					databaseUser: "admin",
					databasePassword: "secret",
					databaseRootPassword: "rootpw",
				},
				null,
			);
			expect(env).toBe(
				'MYSQL_USER="admin"\nMYSQL_DATABASE="app"\nMYSQL_PASSWORD="secret"\nMYSQL_ROOT_PASSWORD="rootpw"',
			);
		});

		it("mysql with the root user omits MYSQL_USER", () => {
			const env = getDatabaseEngine("mysql").buildDefaultEnv(
				{
					databaseName: "app",
					databaseUser: "root",
					databasePassword: "secret",
					databaseRootPassword: "rootpw",
				},
				null,
			);
			expect(env).toBe('MYSQL_DATABASE="app"\nMYSQL_ROOT_PASSWORD="rootpw"');
		});

		it("mariadb", () => {
			const env = getDatabaseEngine("mariadb").buildDefaultEnv(
				{
					databaseName: "app",
					databaseUser: "admin",
					databasePassword: "secret",
					databaseRootPassword: "rootpw",
				},
				null,
			);
			expect(env).toBe(
				'MARIADB_DATABASE="app"\nMARIADB_USER="admin"\nMARIADB_PASSWORD="secret"\nMARIADB_ROOT_PASSWORD="rootpw"',
			);
		});

		it("mongo with replica sets adds MONGO_INITDB_DATABASE", () => {
			const env = getDatabaseEngine("mongo").buildDefaultEnv(
				{
					databaseUser: "admin",
					databasePassword: "secret",
					replicaSets: true,
				},
				null,
			);
			expect(env).toBe(
				'MONGO_INITDB_ROOT_USERNAME="admin"\nMONGO_INITDB_ROOT_PASSWORD="secret"\nMONGO_INITDB_DATABASE=admin',
			);
		});

		it("redis", () => {
			const env = getDatabaseEngine("redis").buildDefaultEnv(
				{ databasePassword: "secret" },
				null,
			);
			expect(env).toBe('REDIS_PASSWORD="secret"');
		});

		it("libsql primary node base64-encodes basic auth", () => {
			const env = getDatabaseEngine("libsql").buildDefaultEnv(
				{
					databaseUser: "admin",
					databasePassword: "secret",
					sqldNode: "primary",
					enableNamespaces: false,
				},
				null,
			);
			const basic = Buffer.from("admin:secret", "utf-8").toString("base64");
			expect(env).toBe(`SQLD_NODE="primary"\nSQLD_HTTP_AUTH="basic:${basic}"`);
		});

		it("libsql replica node includes SQLD_PRIMARY_URL", () => {
			const env = getDatabaseEngine("libsql").buildDefaultEnv(
				{
					databaseUser: "admin",
					databasePassword: "secret",
					sqldNode: "replica",
					sqldPrimaryUrl: "http://primary:5001",
					enableNamespaces: false,
				},
				null,
			);
			expect(env).toContain('SQLD_NODE="replica"');
			expect(env).toContain('SQLD_PRIMARY_URL="http://primary:5001"');
		});
	});

	describe("connectionVars reproduce the workspace-graph recipes", () => {
		it("postgres", () => {
			const vars = getDatabaseEngine("postgres").connectionVars({
				appName: "pg-app",
				config: {
					databaseName: "app",
					databaseUser: "ad min",
					databasePassword: "p@ss",
				},
			});
			expect(vars[0]).toEqual({
				key: "DATABASE_URL",
				value: "postgresql://ad%20min:p%40ss@pg-app:5432/app",
			});
			expect(vars).toContainEqual({ key: "POSTGRES_HOST", value: "pg-app" });
		});

		it("redis url has no user segment", () => {
			const vars = getDatabaseEngine("redis").connectionVars({
				appName: "redis-app",
				config: { databasePassword: "p@ss" },
			});
			expect(vars[0]).toEqual({
				key: "REDIS_URL",
				value: "redis://:p%40ss@redis-app:6379",
			});
		});

		it("libsql emits url + token", () => {
			const vars = getDatabaseEngine("libsql").connectionVars({
				appName: "lib-app",
				config: {
					databaseUser: "admin",
					databasePassword: "token123",
					sqldNode: "primary",
					enableNamespaces: false,
				},
			});
			expect(vars).toEqual([
				{ key: "LIBSQL_URL", value: "http://lib-app:8080" },
				{ key: "LIBSQL_AUTH_TOKEN", value: "token123" },
			]);
		});
	});

	describe("mountPath", () => {
		it("postgres 18+ uses the versioned path", () => {
			expect(getDatabaseEngine("postgres").mountPath("postgres:18")).toBe(
				"/var/lib/postgresql/18/docker",
			);
		});
		it("postgres <18 uses the legacy data path", () => {
			expect(getDatabaseEngine("postgres").mountPath("postgres:16")).toBe(
				"/var/lib/postgresql/data",
			);
		});
		it("non-postgres engines use fixed mount paths", () => {
			expect(getDatabaseEngine("mysql").mountPath("mysql:8")).toBe(
				"/var/lib/mysql",
			);
			expect(getDatabaseEngine("mongo").mountPath("mongo:8")).toBe("/data/db");
			expect(getDatabaseEngine("redis").mountPath("redis:7")).toBe("/data");
			expect(getDatabaseEngine("libsql").mountPath("x")).toBe("/var/lib/sqld");
		});
	});

	describe("capabilities", () => {
		it("postgres/mysql/mariadb/mongo support logical backups; redis/libsql do not", () => {
			expect(getDatabaseEngine("postgres").backup).toBeDefined();
			expect(getDatabaseEngine("mysql").backup).toBeDefined();
			expect(getDatabaseEngine("mariadb").backup).toBeDefined();
			expect(getDatabaseEngine("mongo").backup).toBeDefined();
			expect(getDatabaseEngine("redis").backup).toBeUndefined();
			expect(getDatabaseEngine("libsql").backup).toBeUndefined();
		});

		it("uses the correct dump binary per engine", () => {
			expect(
				getDatabaseEngine("postgres").backup?.dumpCommand({
					database: "app",
					databaseUser: "admin",
					databasePassword: "pw",
				}),
			).toContain("pg_dump");
			expect(
				getDatabaseEngine("mysql").backup?.dumpCommand({
					database: "app",
					databaseUser: "admin",
					databasePassword: "pw",
				}),
			).toContain("mysqldump");
			expect(
				getDatabaseEngine("mariadb").backup?.dumpCommand({
					database: "app",
					databaseUser: "admin",
					databasePassword: "pw",
				}),
			).toContain("mariadb-dump");
			expect(
				getDatabaseEngine("mongo").backup?.dumpCommand({
					database: "app",
					databaseUser: "admin",
					databasePassword: "pw",
				}),
			).toContain("mongodump");
		});

		it("change-password uses the right client per engine; libsql has none", () => {
			expect(
				getDatabaseEngine("postgres").changePassword?.({
					databaseUser: "admin",
					databasePassword: "old",
					newPassword: "new",
				}),
			).toContain("ALTER USER");
			expect(
				getDatabaseEngine("redis").changePassword?.({
					databaseUser: "",
					databasePassword: "old",
					newPassword: "new",
				}),
			).toContain("requirepass");
			expect(getDatabaseEngine("libsql").changePassword).toBeUndefined();
		});
	});

	describe("parseDatabaseConfig", () => {
		it("validates and returns a typed config", () => {
			const config = parseDatabaseConfig("postgres", {
				databaseName: "app",
				databaseUser: "admin",
				databasePassword: "pw",
			});
			expect(config.databaseName).toBe("app");
		});
		it("throws on an invalid config", () => {
			expect(() =>
				parseDatabaseConfig("postgres", { databaseName: "app" }),
			).toThrow();
		});
		it("applies defaults (mongo replicaSets, libsql sqldNode)", () => {
			expect(
				parseDatabaseConfig("mongo", {
					databaseUser: "a",
					databasePassword: "b",
				}).replicaSets,
			).toBe(false);
			expect(
				parseDatabaseConfig("libsql", {
					databaseUser: "a",
					databasePassword: "b",
				}).sqldNode,
			).toBe("primary");
		});
	});

	describe("extractDatabaseCredentials (template bridge)", () => {
		it("extracts postgres credentials from standard env", () => {
			const config = extractDatabaseCredentials("postgres", {
				POSTGRES_DB: "app",
				POSTGRES_USER: "admin",
				POSTGRES_PASSWORD: "secret",
			});
			expect(config).toEqual({
				databaseName: "app",
				databaseUser: "admin",
				databasePassword: "secret",
			});
		});

		it("keeps conventional name/user defaults when only the password is set", () => {
			const config = extractDatabaseCredentials("postgres", {
				POSTGRES_PASSWORD: "secret",
			});
			expect(config.databaseName).toBe("postgres");
			expect(config.databaseUser).toBe("postgres");
		});

		it("throws (does not silently default) when an auth-required password is missing", () => {
			expect(() => extractDatabaseCredentials("postgres", {})).toThrow(
				DatabaseCredentialExtractionError,
			);
			expect(() => extractDatabaseCredentials("mysql", {})).toThrow(
				DatabaseCredentialExtractionError,
			);
			expect(() => extractDatabaseCredentials("mariadb", {})).toThrow(
				DatabaseCredentialExtractionError,
			);
		});

		it("accepts the root password as the mysql/mariadb credential", () => {
			expect(
				extractDatabaseCredentials("mysql", { MYSQL_ROOT_PASSWORD: "rootpw" })
					.databasePassword,
			).toBe("rootpw");
			expect(
				extractDatabaseCredentials("mariadb", {
					MARIADB_ROOT_PASSWORD: "rootpw",
				}).databasePassword,
			).toBe("rootpw");
		});

		it("allows an empty password for no-auth engines (redis/mongo/libsql)", () => {
			expect(() => extractDatabaseCredentials("redis", {})).not.toThrow();
			expect(() => extractDatabaseCredentials("mongo", {})).not.toThrow();
			expect(() => extractDatabaseCredentials("libsql", {})).not.toThrow();
			expect(extractDatabaseCredentials("redis", {}).databasePassword).toBe("");
		});
	});

	describe("shell-safety boundary (change-password / backup commands)", () => {
		it("builds a postgres change-password command for safe input", () => {
			const cmd = databaseChangePasswordCommand("postgres", {
				databaseUser: "admin",
				databasePassword: "old",
				newPassword: "Str0ng-Pass_1",
			});
			expect(cmd).toContain("ALTER USER");
			expect(cmd).toContain("Str0ng-Pass_1");
		});

		it("rejects a password with a backtick (command substitution)", () => {
			expect(() =>
				databaseChangePasswordCommand("postgres", {
					databaseUser: "admin",
					databasePassword: "old",
					newPassword: "a`whoami`b",
				}),
			).toThrow(UnsafeDatabaseShellValueError);
		});

		it("rejects a username with a shell metacharacter", () => {
			expect(() =>
				databaseChangePasswordCommand("postgres", {
					databaseUser: "admin$(id)",
					databasePassword: "old",
					newPassword: "ok",
				}),
			).toThrow(UnsafeDatabaseShellValueError);
		});

		it("validates backup-command inputs too", () => {
			expect(() =>
				databaseBackupCommand("postgres", {
					database: "app",
					databaseUser: "admin",
					databasePassword: "p'w",
				}),
			).toThrow(UnsafeDatabaseShellValueError);
		});
	});
});
