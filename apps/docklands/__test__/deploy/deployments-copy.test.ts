import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const deploymentsSource = () =>
	readFileSync(
		fileURLToPath(
			new URL(
				"../../components/dashboard/deployments/show-deployments-table.tsx",
				import.meta.url,
			),
		),
		"utf8",
	);

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
