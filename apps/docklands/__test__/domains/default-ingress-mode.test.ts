import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R2a — `defaultIngressMode` must actually flow end-to-end:
 *  (a) the settings service persists it (the write path the router calls), and
 *  (b) a new domain created without an explicit `ingressMode` inherits the
 *      instance default.
 *
 * Both are pure-service tests with the db / Cloudflare deps mocked, so no real
 * Postgres or network is touched.
 */

// --- shared db mock ---------------------------------------------------------

const setSpy = vi.fn();
const insertValuesSpy = vi.fn();
const findFirstSettings = vi.fn();

// A chainable update() that records the `.set()` payload.
function makeUpdateChain() {
	const chain = {
		set: (payload: unknown) => {
			setSpy(payload);
			return chain;
		},
		where: () => chain,
		returning: () => Promise.resolve([{ id: "settings-1" }]),
	};
	return chain;
}

// A chainable insert() (used inside createDomain's transaction) that records
// the inserted `values` and echoes them back from `.returning()`.
function makeInsertChain() {
	let captured: Record<string, unknown> = {};
	const chain = {
		values: (payload: Record<string, unknown>) => {
			captured = payload;
			insertValuesSpy(payload);
			return chain;
		},
		returning: () => Promise.resolve([{ domainId: "domain-1", ...captured }]),
	};
	return chain;
}

const tx = {
	insert: () => makeInsertChain(),
};

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			webServerSettings: {
				findFirst: (...args: unknown[]) => findFirstSettings(...args),
			},
		},
		update: () => makeUpdateChain(),
		insert: () => makeInsertChain(),
		transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
	},
}));

vi.mock("@/server/core/db/schema", () => ({
	webServerSettings: {},
	domains: {},
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

// createDomain dependencies that we don't exercise here.
const requireCloudflareIntegration = vi.fn();
const findZoneForHost = vi.fn();
const attachDomainToTunnel = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/core/services/cloudflare", () => ({
	requireCloudflareIntegration: (...args: unknown[]) =>
		requireCloudflareIntegration(...args),
	findZoneForHost: (...args: unknown[]) => findZoneForHost(...args),
}));

vi.mock("@/server/core/services/tunnel", () => ({
	attachDomainToTunnel: (...args: unknown[]) => attachDomainToTunnel(...args),
	detachDomainFromTunnel: vi.fn(),
}));

import { createDomain } from "../../server/core/services/domain";
import { updateWebServerSettings } from "../../server/core/services/web-server-settings";

beforeEach(() => {
	vi.clearAllMocks();
	findFirstSettings.mockResolvedValue({ id: "settings-1" });
});

describe("settings write path", () => {
	it("persists defaultIngressMode through updateWebServerSettings", async () => {
		await updateWebServerSettings({ defaultIngressMode: "tunnel" });

		expect(setSpy).toHaveBeenCalledTimes(1);
		const payload = setSpy.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(payload.defaultIngressMode).toBe("tunnel");
	});
});

describe("createDomain inherits the instance default", () => {
	it("uses defaultIngressMode when no ingressMode is supplied (public)", async () => {
		findFirstSettings.mockResolvedValue({
			id: "settings-1",
			defaultIngressMode: "public",
		});

		const result = (await createDomain({
			host: "app.example.com",
			applicationId: null,
		} as never)) as { ingressMode: string };

		expect(insertValuesSpy).toHaveBeenCalledTimes(1);
		const inserted = insertValuesSpy.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(inserted.ingressMode).toBe("public");
		expect(result.ingressMode).toBe("public");
		// Public path never touches Cloudflare.
		expect(requireCloudflareIntegration).not.toHaveBeenCalled();
		expect(attachDomainToTunnel).not.toHaveBeenCalled();
	});

	it("inherits a tunnel-first default for new domains", async () => {
		findFirstSettings.mockResolvedValue({
			id: "settings-1",
			defaultIngressMode: "tunnel",
		});
		requireCloudflareIntegration.mockResolvedValue({
			zones: [{ name: "example.com" }],
		});
		findZoneForHost.mockReturnValue({ name: "example.com" });

		const result = (await createDomain({
			host: "app.example.com",
			applicationId: null,
		} as never)) as { ingressMode: string; certificateType: string };

		const inserted = insertValuesSpy.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(inserted.ingressMode).toBe("tunnel");
		// Tunnel mode forces certificateType to none (TLS at the edge).
		expect(inserted.certificateType).toBe("none");
		expect(result.ingressMode).toBe("tunnel");
		// Tunnel domains attach a DNS record after creation.
		expect(attachDomainToTunnel).toHaveBeenCalledTimes(1);
	});

	it("an explicit ingressMode still overrides the instance default", async () => {
		findFirstSettings.mockResolvedValue({
			id: "settings-1",
			defaultIngressMode: "tunnel",
		});

		const result = (await createDomain({
			host: "app.example.com",
			applicationId: null,
			ingressMode: "public",
		} as never)) as { ingressMode: string };

		const inserted = insertValuesSpy.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(inserted.ingressMode).toBe("public");
		expect(result.ingressMode).toBe("public");
		expect(requireCloudflareIntegration).not.toHaveBeenCalled();
	});
});
