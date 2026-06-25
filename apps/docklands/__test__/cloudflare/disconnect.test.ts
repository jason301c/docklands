import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstTunnel = vi.fn();
const deleteCloudflareIntegration = vi.fn();

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			tunnels: {
				findFirst: (...args: unknown[]) => findFirstTunnel(...args),
			},
		},
		delete: (...args: unknown[]) => deleteCloudflareIntegration(...args),
	},
}));

vi.mock("@/server/core/db/schema", () => ({
	cloudflareIntegration: {},
}));

vi.mock("@/server/core/utils/cloudflare/client", () => ({
	listAccounts: vi.fn(),
	listZones: vi.fn(),
	verifyToken: vi.fn(),
}));

import { disconnectCloudflare } from "@/server/core/services/cloudflare";

beforeEach(() => {
	vi.clearAllMocks();
	findFirstTunnel.mockResolvedValue(null);
	deleteCloudflareIntegration.mockResolvedValue(undefined);
});

describe("disconnectCloudflare", () => {
	it("deletes the Cloudflare integration when no managed tunnel exists", async () => {
		await expect(disconnectCloudflare()).resolves.toBeUndefined();

		expect(findFirstTunnel).toHaveBeenCalledTimes(1);
		expect(deleteCloudflareIntegration).toHaveBeenCalledTimes(1);
	});

	it("refuses to disconnect while Docklands still has a managed tunnel", async () => {
		findFirstTunnel.mockResolvedValue({
			tunnelId: "tun-1",
			name: "docklands",
		});

		await expect(disconnectCloudflare()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message:
				"Remove the managed Cloudflare Tunnel before disconnecting Cloudflare.",
		});

		expect(deleteCloudflareIntegration).not.toHaveBeenCalled();
	});
});
