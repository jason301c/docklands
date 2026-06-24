import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const overviewSource = () =>
	readFileSync(
		fileURLToPath(
			new URL(
				"../../components/dashboard/workspace/workspace-overview.tsx",
				import.meta.url,
			),
		),
		"utf8",
	);

describe("workspace overview first-run state", () => {
	it("uses a canvas-first empty state instead of inherited placeholders", () => {
		const source = overviewSource();

		expect(source).toContain("Start from a workspace canvas");
		expect(source).toContain("Create the first workspace");
		expect(source).toContain("showFirstRun");
		expect(source).toContain("projects.length === 0");
		expect(source).toContain("<HandleWorkspace />");
		expect(source).not.toContain("No workspaces yet.");
		expect(source).not.toContain("No deployments yet.");
	});
});
