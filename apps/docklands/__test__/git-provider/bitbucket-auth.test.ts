import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("Bitbucket authentication", () => {
	it("keeps active Bitbucket flows on API tokens", () => {
		const activeFiles = [
			"components/dashboard/settings/git/bitbucket/add-bitbucket-provider.tsx",
			"components/dashboard/settings/git/bitbucket/edit-bitbucket-provider.tsx",
			"components/dashboard/settings/git/show-git-providers.tsx",
			"server/api/routers/git-provider.ts",
			"server/core/services/bitbucket.ts",
			"server/core/utils/providers/bitbucket.ts",
		];

		for (const file of activeFiles) {
			const source = sourceFile(file);

			expect(source).not.toContain("appPassword");
			expect(source).not.toContain("App Password");
			expect(source).not.toContain("isDeprecated");
			expect(source).not.toContain("Deprecated");
		}

		expect(
			sourceFile(
				"components/dashboard/settings/git/bitbucket/add-bitbucket-provider.tsx",
			),
		).toContain("API Token");
		expect(
			sourceFile(
				"components/dashboard/settings/git/bitbucket/edit-bitbucket-provider.tsx",
			),
		).toContain("API Token");
		expect(sourceFile("server/core/utils/providers/bitbucket.ts")).toContain(
			"Bitbucket API token is required",
		);
	});

	it("removes the old Bitbucket App Password column from active schemas", () => {
		const schema = sourceFile("server/core/db/schema/bitbucket.ts");
		const migration = sourceFile(
			"drizzle/0002_remove_legacy_project_env_and_bitbucket_password.sql",
		);

		expect(schema).not.toContain("appPassword");
		expect(schema).toContain("export const apiCreateBitbucket = createSchema");
		expect(schema).toContain(
			"export const apiBitbucketTestConnection = createSchema",
		);
		expect(schema).toContain("export const apiUpdateBitbucket = createSchema");
		expect(migration).toContain(
			'ALTER TABLE "bitbucket" DROP COLUMN "appPassword";',
		);
	});
});
