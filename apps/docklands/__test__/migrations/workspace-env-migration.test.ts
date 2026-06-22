import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const baseline = readFileSync(
	fileURLToPath(
		new URL("../../drizzle/0000_docklands_baseline.sql", import.meta.url),
	),
	"utf8",
);

describe("workspace env migration", () => {
	it("keeps the reset baseline on workspace env names without old credential storage", () => {
		for (const [table, column] of [
			["workspace", "env"],
			["environment", "env"],
			["application", "env"],
			["application", "previewEnv"],
			["compose", "env"],
			["libsql", "env"],
			["mariadb", "env"],
			["mongo", "env"],
			["mysql", "env"],
			["postgres", "env"],
			["redis", "env"],
		]) {
			expect(baseline).toContain(`"${column}" text`);
			expect(baseline).not.toContain(`UPDATE "${table}" SET "${column}"`);
		}

		expect(baseline).not.toContain("${{project.");
		expect(baseline).not.toContain('"appPassword"');
	});
});
