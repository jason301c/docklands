import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

const sharedFilterPath = fileURLToPath(
	new URL("../../components/shared/runtime-worker-filter.tsx", import.meta.url),
);

describe("runtime worker filter copy", () => {
	it("uses runtime-worker naming for the shared remote-machine filter", () => {
		const source = sourceFile("components/shared/runtime-worker-filter.tsx");

		expect(source).toContain("RuntimeWorkerFilter");
		expect(source).toContain("LOCAL_RUNTIME_WORKER");
		expect(source).toContain("Runtime worker");
		expect(source).toContain("Runtime worker filter");
		expect(source).toContain("Runtime workers");
		expect(source).toContain("No runtime workers yet");
		expect(source).toContain("Local runtime worker");
		expect(source).toContain('"runtimeWorkerId"');
		expect(source).toContain('query.set("runtimeWorkerId"');
		expect(source).not.toContain("ServerFilter");
		expect(source).not.toContain("DOCKLANDS_SERVER");
		expect(source).not.toContain("server-filter");
		expect(source).not.toContain("Runtime capacity");
		expect(source).not.toContain("No runtime capacity yet");
		expect(source).not.toContain("Runtime filter");
		expect(source).not.toContain("remote runtime capacity");
	});

	it("keeps runtime pages on the shared runtime worker filter", () => {
		const pages = [
			"app/dashboard/automations/_client.tsx",
			"app/dashboard/cluster-runtime/_client.tsx",
			"app/dashboard/container-runtime/_client.tsx",
			"app/dashboard/proxy-files/_client.tsx",
			"app/dashboard/settings/cluster-nodes/_client.tsx",
		];

		for (const page of pages) {
			const source = sourceFile(page);

			expect(source).toContain(
				'from "@/components/shared/runtime-worker-filter"',
			);
			expect(source).toContain("RuntimeWorkerFilter");
			expect(source).not.toContain("server-filter");
			expect(source).not.toContain("ServerFilter");
		}
	});

	it("removes the old shared runtimeWorker filter module", () => {
		expect(existsSync(sharedFilterPath)).toBe(true);
		expect(
			existsSync(
				fileURLToPath(
					new URL("../../components/shared/server-filter.tsx", import.meta.url),
				),
			),
		).toBe(false);
	});

	it("emits runtime-worker query params for websocket clients", () => {
		const websocketClients = [
			"components/dashboard/settings/runtime/terminal/runtime-terminal.tsx",
			"components/dashboard/container-runtime/terminal/docker-terminal.tsx",
			"components/dashboard/container-runtime/logs/docker-logs-id.tsx",
			"components/dashboard/application/deployments/show-deployment.tsx",
		];

		for (const client of websocketClients) {
			const source = sourceFile(client);

			expect(source).toContain("runtimeWorkerId");
			expect(source).not.toContain("serverId");
		}
	});
});
