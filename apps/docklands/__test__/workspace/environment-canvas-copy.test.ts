import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canvasSource = () =>
	readFileSync(
		fileURLToPath(
			new URL(
				"../../components/dashboard/workspace/environment-canvas.tsx",
				import.meta.url,
			),
		),
		"utf8",
	);

describe("environment canvas deployment copy", () => {
	it("uses deployment language for visible service actions", () => {
		const source = canvasSource();

		expect(source).toContain('label: "Recent deployment"');
		expect(source).toContain("deployment queued");
		expect(source).toContain("Could not queue deployment");
		expect(source).toContain("queue deployment");
		expect(source).toContain("`Deploy ${service.name}`");
		expect(source).toContain("`Deployment history for ${service.name}`");
		expect(source).not.toContain("Run build");
		expect(source).not.toContain("Recent build");
		expect(source).not.toContain("queued for build");
		expect(source).not.toContain("queue build");
		expect(source).not.toContain("Build history");
	});
});
