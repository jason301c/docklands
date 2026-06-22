import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

const serviceClientsDir = fileURLToPath(
	new URL(
		"../../app/dashboard/workspace/[projectId]/[environmentId]/service/[serviceType]/[serviceId]/_clients",
		import.meta.url,
	),
);

describe("service runtime placement copy", () => {
	it("uses explicit runtime-worker placement labels", () => {
		const source = sourceFile(
			"components/dashboard/service/runtime-placement-status.tsx",
		);

		expect(source).toContain("Automatic placement");
		expect(source).toContain("Runtime worker");
		expect(source).toContain("Runtime worker inactive");
		expect(source).toContain("Runtime worker address copied");
		expect(source).not.toContain("Runtime address copied");
		expect(source).not.toContain("This runtime is inactive.");
	});

	it("keeps canonical service clients on the shared placement surface", () => {
		const clientFiles = readdirSync(serviceClientsDir).filter((file) =>
			file.endsWith("-client.tsx"),
		);

		expect(clientFiles.length).toBeGreaterThan(0);

		for (const file of clientFiles) {
			const source = sourceFile(
				`app/dashboard/workspace/[projectId]/[environmentId]/service/[serviceType]/[serviceId]/_clients/${file}`,
			);

			expect(source).toContain("RuntimePlacementStatus");
			expect(source).toContain("RuntimeWorkerInactiveState");
			expect(source).not.toContain("Runtime address copied");
			expect(source).not.toContain("This runtime is inactive.");
			expect(source).not.toContain(
				"This service's runtime is currently marked inactive.",
			);
		}
	});
});
