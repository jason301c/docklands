import { describe, expect, it } from "vitest";
import {
	assertBundledPostgresForInstanceBackup,
	INSTANCE_BACKUP_BUNDLED_POSTGRES_ONLY_MESSAGE,
	resolveBundledPostgresConnection,
	usesBundledPostgresForInstanceBackup,
} from "@/server/core/utils/backups/instance-backup-support";

describe("usesBundledPostgresForInstanceBackup", () => {
	it("allows the default bundled Postgres configuration", () => {
		expect(usesBundledPostgresForInstanceBackup({})).toBe(true);
	});

	it("allows DATABASE_URL pointing at the bundled service name", () => {
		expect(
			usesBundledPostgresForInstanceBackup({
				DATABASE_URL:
					"postgres://docklands:secret@docklands-postgres:5432/docklands",
			}),
		).toBe(true);
	});

	it("blocks an explicitly skipped bundled Postgres setup", () => {
		expect(
			usesBundledPostgresForInstanceBackup({
				SKIP_BUNDLED_POSTGRES: "true",
				DATABASE_URL:
					"postgres://docklands:secret@docklands-postgres:5432/docklands",
			}),
		).toBe(false);
	});

	it("blocks DATABASE_URL pointing at an external Postgres host", () => {
		expect(
			usesBundledPostgresForInstanceBackup({
				DATABASE_URL:
					"postgres://docklands:secret@db.example.com:5432/docklands",
			}),
		).toBe(false);
	});

	it("blocks POSTGRES_HOST pointing at an external Postgres host", () => {
		expect(
			usesBundledPostgresForInstanceBackup({
				POSTGRES_HOST: "managed-postgres.internal",
			}),
		).toBe(false);
	});
});

describe("assertBundledPostgresForInstanceBackup", () => {
	it("throws the operator guidance for external Postgres", () => {
		expect(() =>
			assertBundledPostgresForInstanceBackup({
				DATABASE_URL:
					"postgres://docklands:secret@db.example.com:5432/docklands",
			}),
		).toThrow(INSTANCE_BACKUP_BUNDLED_POSTGRES_ONLY_MESSAGE);
	});
});

describe("resolveBundledPostgresConnection", () => {
	it("defaults to the historical bundled database credentials", () => {
		expect(resolveBundledPostgresConnection({})).toEqual({
			user: "docklands",
			database: "docklands",
		});
	});

	it("derives the bundled database user and database from DATABASE_URL", () => {
		expect(
			resolveBundledPostgresConnection({
				DATABASE_URL:
					"postgres://docklands_user:secret@docklands-postgres:5432/docklands_db",
			}),
		).toEqual({
			user: "docklands_user",
			database: "docklands_db",
		});
	});

	it("falls back to POSTGRES_USER and POSTGRES_DB when DATABASE_URL is absent", () => {
		expect(
			resolveBundledPostgresConnection({
				POSTGRES_USER: "from_env",
				POSTGRES_DB: "from_env_db",
			}),
		).toEqual({
			user: "from_env",
			database: "from_env_db",
		});
	});
});
