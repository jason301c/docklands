import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
	readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

// The canvas was decomposed into environment-canvas.tsx + canvas/* modules, so a
// given piece of copy may live in either. Concatenate the main file with every
// canvas/* module so this copy check is robust to where a string is extracted to.
const canvasSource = () => {
	const main = read(
		"../../components/dashboard/workspace/environment-canvas.tsx",
	);
	const canvasDir = fileURLToPath(
		new URL("../../components/dashboard/workspace/canvas/", import.meta.url),
	);
	const extracted = readdirSync(canvasDir)
		.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
		.map((f) => read(`../../components/dashboard/workspace/canvas/${f}`))
		.join("\n");
	return `${main}\n${extracted}`;
};

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
