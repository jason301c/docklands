import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getUpdateData,
	resolveLatestStableImageTag,
} from "@/server/core/services/settings";

type DockerHubPage = {
	next: string | null;
	results: { digest: string; name: string }[];
};

function mockDockerHubPages(...pages: DockerHubPage[]) {
	const queue = [...pages];
	const fetchMock = vi.fn(async () => {
		const page = queue.shift();
		if (!page) {
			throw new Error("Unexpected Docker Hub request");
		}

		return {
			ok: true,
			status: 200,
			json: async () => page,
		};
	});

	vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("resolveLatestStableImageTag", () => {
	it("resolves the plain semver tag that shares the latest digest", () => {
		expect(
			resolveLatestStableImageTag([
				{ name: "canary", digest: "sha-canary" },
				{ name: "latest", digest: "sha-release" },
				{ name: "0.1.0", digest: "sha-old" },
				{ name: "0.2.0", digest: "sha-release" },
				{ name: "v0.2.0", digest: "sha-release" },
			]),
		).toEqual({
			name: "0.2.0",
			version: "0.2.0",
		});
	});

	it("does not treat v-prefixed tags as production image tags", () => {
		expect(
			resolveLatestStableImageTag([
				{ name: "latest", digest: "sha-release" },
				{ name: "v0.2.0", digest: "sha-release" },
			]),
		).toBeNull();
	});
});

describe("getUpdateData", () => {
	it("reports a stable update from paginated Docker Hub results", async () => {
		const fetchMock = mockDockerHubPages(
			{
				next: "https://hub.example/page-2",
				results: [{ name: "0.1.0", digest: "sha-old" }],
			},
			{
				next: null,
				results: [
					{ name: "latest", digest: "sha-new" },
					{ name: "0.2.0", digest: "sha-new" },
				],
			},
		);

		await expect(getUpdateData("0.1.0")).resolves.toEqual({
			latestVersion: "0.2.0",
			updateAvailable: true,
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("?page_size=100"),
			expect.any(Object),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://hub.example/page-2",
			expect.any(Object),
		);
	});

	it("does not report an update when the current version matches latest", async () => {
		mockDockerHubPages({
			next: null,
			results: [
				{ name: "latest", digest: "sha-release" },
				{ name: "0.1.0", digest: "sha-release" },
			],
		});

		await expect(getUpdateData("0.1.0")).resolves.toEqual({
			latestVersion: "0.1.0",
			updateAvailable: false,
		});
	});
});
