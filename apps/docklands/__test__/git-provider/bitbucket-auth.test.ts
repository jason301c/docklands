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

	it("omits the old Bitbucket App Password column from API schemas", () => {
		const source = sourceFile("server/core/db/schema/bitbucket.ts");

		expect(source).toContain(
			"const activeBitbucketSchema = createSchema.omit({ appPassword: true });",
		);
		expect(source).toContain(
			"export const apiCreateBitbucket = activeBitbucketSchema",
		);
		expect(source).toContain(
			"export const apiBitbucketTestConnection = activeBitbucketSchema",
		);
		expect(source).toContain(
			"export const apiUpdateBitbucket = activeBitbucketSchema",
		);
	});
});
