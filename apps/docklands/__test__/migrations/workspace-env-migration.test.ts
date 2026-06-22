import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	fileURLToPath(
		new URL(
			"../../drizzle/0002_remove_legacy_project_env_and_bitbucket_password.sql",
			import.meta.url,
		),
	),
	"utf8",
);

describe("workspace env migration", () => {
	it("rewrites stored project env references before removing old credential storage", () => {
		for (const [table, column] of [
			["project", "env"],
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
			expect(migration).toContain(
				`UPDATE "${table}" SET "${column}" = replace("${column}", '\${{project.', '\${{workspace.')`,
			);
		}

		expect(migration).toContain(
			'ALTER TABLE "bitbucket" DROP COLUMN "appPassword";',
		);
	});
});
