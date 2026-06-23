import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const deploymentsSource = () =>
	[
		"../../components/dashboard/deployments/show-deployments-table.tsx",
		"../../components/dashboard/deployments/deployments-columns.tsx",
	]
		.map((relativePath) =>
			readFileSync(
				fileURLToPath(new URL(relativePath, import.meta.url)),
				"utf8",
			),
		)
		.join("\n");

describe("deployment history copy", () => {
	it("uses workspace language for the deployment table surface", () => {
		const source = deploymentsSource();

		expect(source).toContain("workspaceName");
		expect(source).toContain("Workspace");
		expect(source).toContain(
			"Latest runtime changes across every workspace and environment.",
		);
		expect(source).toContain(
			'placeholder="Search by name, workspace, environment, or title..."',
		);
		expect(source).not.toContain("projectName");
		expect(source).not.toContain("every project and environment");
		expect(source).not.toContain("Search by name, project");
	});
});
