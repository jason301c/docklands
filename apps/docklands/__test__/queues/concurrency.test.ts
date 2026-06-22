import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebServerSettings = vi.fn();
const findFirstRuntimeWorker = vi.fn();

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			runtimeWorkers: {
				findFirst: (...args: unknown[]) => findFirstRuntimeWorker(...args),
			},
		},
	},
}));

vi.mock("@/server/core/db/schema", () => ({
	runtimeWorkers: {},
}));

vi.mock("@/server/core/services/web-server-settings", () => ({
	getWebServerSettings: (...args: unknown[]) => getWebServerSettings(...args),
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import {
	assertBuildsConcurrencyAllowed,
	resolveBuildsConcurrency,
} from "../../server/queues/concurrency";
import { LOCAL_PARTITION } from "../../server/queues/in-memory-queue";

describe("resolveBuildsConcurrency", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("local web server partition", () => {
		it("returns the configured concurrency", async () => {
			getWebServerSettings.mockResolvedValue({ buildsConcurrency: 5 });

			await expect(resolveBuildsConcurrency(LOCAL_PARTITION)).resolves.toBe(5);
		});

		it("floors invalid configured values to 1", async () => {
			getWebServerSettings.mockResolvedValue({ buildsConcurrency: 0 });

			await expect(resolveBuildsConcurrency(LOCAL_PARTITION)).resolves.toBe(1);
		});

		it("defaults to 1 when settings are missing", async () => {
			getWebServerSettings.mockResolvedValue(undefined);

			await expect(resolveBuildsConcurrency(LOCAL_PARTITION)).resolves.toBe(1);
		});
	});

	describe("remote runtime worker partition", () => {
		it("returns the runtime worker concurrency", async () => {
			findFirstRuntimeWorker.mockResolvedValue({ buildsConcurrency: 4 });

			await expect(resolveBuildsConcurrency("runtimeWorker-1")).resolves.toBe(
				4,
			);
		});

		it("floors remote runtime worker concurrency to 1", async () => {
			findFirstRuntimeWorker.mockResolvedValue({ buildsConcurrency: -3 });

			await expect(resolveBuildsConcurrency("runtimeWorker-1")).resolves.toBe(
				1,
			);
		});

		it("defaults to 1 for an unknown runtime worker", async () => {
			findFirstRuntimeWorker.mockResolvedValue(undefined);

			await expect(resolveBuildsConcurrency("ghost")).resolves.toBe(1);
		});
	});

	it("falls back to 1 if resolution throws", async () => {
		getWebServerSettings.mockRejectedValue(new Error("db down"));

		await expect(resolveBuildsConcurrency(LOCAL_PARTITION)).resolves.toBe(1);
	});
});

describe("assertBuildsConcurrencyAllowed", () => {
	it("allows any configured positive concurrency", async () => {
		await expect(
			assertBuildsConcurrencyAllowed(20, "org-1"),
		).resolves.toBeUndefined();
	});
});
