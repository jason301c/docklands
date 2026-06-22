import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceSource = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("workspace visible product copy", () => {
	it("keeps workspace dialogs on Docklands product nouns", () => {
		const canvas = workspaceSource(
			"components/dashboard/workspace/environment-canvas.tsx",
		);
		const environmentSelector = workspaceSource(
			"components/dashboard/workspace/actions/advanced-environment-selector.tsx",
		);

		expect(canvas).toContain("Select a target workspace");
		expect(canvas).not.toContain("Select a target project");
		expect(environmentSelector).toContain(
			"Create a new environment for this workspace.",
		);
		expect(environmentSelector).not.toContain(
			"Create a new environment for your project.",
		);
	});

	it("teaches workspace variable references with the workspace namespace", () => {
		const canvas = workspaceSource(
			"components/dashboard/workspace/environment-canvas.tsx",
		);
		const workspaceVariables = workspaceSource(
			"components/dashboard/workspace/manage/workspace-variables.tsx",
		);

		expect(canvas).toContain("{{workspace.KEY}}");
		expect(canvas).not.toContain("{{project.KEY}}");
		expect(workspaceVariables).toContain("{{workspace.DATABASE_URL}}");
		expect(workspaceVariables).not.toContain("{{project.DATABASE_URL}}");
	});
});
