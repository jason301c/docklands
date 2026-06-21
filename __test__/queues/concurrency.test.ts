import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebServerSettings = vi.fn();
const findFirstServer = vi.fn();

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			server: {
				findFirst: (...args: unknown[]) => findFirstServer(...args),
			},
		},
	},
}));

vi.mock("@/server/core/db/schema", () => ({
	server: {},
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

	describe("remote server partition", () => {
		it("returns the server concurrency", async () => {
			findFirstServer.mockResolvedValue({ buildsConcurrency: 4 });

			await expect(resolveBuildsConcurrency("server-1")).resolves.toBe(4);
		});

		it("floors remote server concurrency to 1", async () => {
			findFirstServer.mockResolvedValue({ buildsConcurrency: -3 });

			await expect(resolveBuildsConcurrency("server-1")).resolves.toBe(1);
		});

		it("defaults to 1 for an unknown server", async () => {
			findFirstServer.mockResolvedValue(undefined);

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
