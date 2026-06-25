import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("production startup", () => {
	it("writes a fresh starting readiness snapshot before Next serves traffic", () => {
		const server = sourceFile("server/server.ts");

		expect(server.indexOf("markReadinessStarting();")).toBeGreaterThanOrEqual(
			0,
		);
		expect(server.indexOf("markReadinessStarting();")).toBeLessThan(
			server.indexOf("setupDirectories();"),
		);
	});

	it("initializes Swarm before creating the overlay network", () => {
		const server = sourceFile("server/server.ts");

		expect(server).toContain("initializeNetwork, initializeSwarm");
		expect(server).toContain('bootStep("swarm", () => initializeSwarm()');
		expect(server.indexOf('bootStep("swarm"')).toBeGreaterThanOrEqual(0);
		expect(server.indexOf('bootStep("swarm"')).toBeLessThan(
			server.indexOf('bootStep("network"'),
		);
	});
});
