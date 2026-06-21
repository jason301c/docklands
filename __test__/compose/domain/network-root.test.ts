import { describe, expect, it } from "vitest";
import { addDocklandsNetworkToRoot } from "@/server/core/utils/docker/domain";

describe("addDocklandsNetworkToRoot", () => {
	it("should create network object if networks is undefined", () => {
		const result = addDocklandsNetworkToRoot(undefined);
		expect(result).toEqual({ "docklands-network": { external: true } });
	});

	it("should add network to an empty object", () => {
		const result = addDocklandsNetworkToRoot({});
		expect(result).toEqual({ "docklands-network": { external: true } });
	});

	it("should not modify existing network configuration", () => {
		const existing = { "docklands-network": { external: false } };
		const result = addDocklandsNetworkToRoot(existing);
		expect(result).toEqual({ "docklands-network": { external: true } });
	});

	it("should add network alongside existing networks", () => {
		const existing = { "other-network": { external: true } };
		const result = addDocklandsNetworkToRoot(existing);
		expect(result).toEqual({
			"other-network": { external: true },
			"docklands-network": { external: true },
		});
	});
});
