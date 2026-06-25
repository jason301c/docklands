import { describe, expect, it } from "vitest";
import {
	assertBundledPostgresForInstanceBackup,
	INSTANCE_BACKUP_BUNDLED_POSTGRES_ONLY_MESSAGE,
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
