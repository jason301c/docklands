import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const OPS_DIR = join(__dirname, "..", "..", "server", "ops");
const MIGRATE_DB = join(OPS_DIR, "migrate-db.ts");

/**
 * Per the "Pre-Release, No Compatibility Debt" policy, the baseline drizzle
 * migration (drizzle/0000_*.sql) creates the workspace / runtimeWorker tables,
 * enums, and columns directly, so a fresh database never needs the upstream
 * project→workspace / server→runtimeWorker rename bridge. The legacy
 * schema-repair shim (and its synthetic reset-baseline adoption) was removed;
 * these tests guard against it being reintroduced on the boot/migration path.
 */
describe("migrate-db has no legacy schema-repair shim", () => {
	it("does not import or call the legacy repair functions", () => {
		const source = readFileSync(MIGRATE_DB, "utf8");
		expect(source).not.toContain("repairLegacySchema");
		expect(source).not.toContain("adoptResetBaseline");
		expect(source).not.toContain("repair-legacy-schema");
	});

	it("still backs up before migrating and runs the drizzle migrator", () => {
		const source = readFileSync(MIGRATE_DB, "utf8");
		const backupIdx = source.indexOf("runPreMigrationBackup");
		const migrateIdx = source.indexOf("migrate(db");
		expect(backupIdx).toBeGreaterThanOrEqual(0);
		expect(migrateIdx).toBeGreaterThanOrEqual(0);
		// Backup must still run before the (potentially destructive) migration.
		expect(backupIdx).toBeLessThan(migrateIdx);
	});

	it("no longer ships the repair-legacy-schema module", () => {
		expect(existsSync(join(OPS_DIR, "repair-legacy-schema.ts"))).toBe(false);
	});
});
