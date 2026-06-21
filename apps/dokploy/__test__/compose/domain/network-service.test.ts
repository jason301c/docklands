import { addDocklandsNetworkToService } from "@dokploy/server";
import { describe, expect, it } from "vitest";

describe("addDocklandsNetworkToService", () => {
	it("should add network to an empty array", () => {
		const result = addDocklandsNetworkToService([]);
		expect(result).toEqual(["dokploy-network", "default"]);
	});

	it("should not add duplicate network to an array", () => {
		const result = addDocklandsNetworkToService(["dokploy-network"]);
		expect(result).toEqual(["dokploy-network", "default"]);
	});

	it("should add network to an existing array with other networks", () => {
		const result = addDocklandsNetworkToService(["other-network"]);
		expect(result).toEqual(["other-network", "dokploy-network", "default"]);
	});

	it("should add network to an object if networks is an object", () => {
		const result = addDocklandsNetworkToService({ "other-network": {} });
		expect(result).toEqual({
			"other-network": {},
			"dokploy-network": {},
			default: {},
		});
	});

	it("should not duplicate default network when already present", () => {
		const result = addDocklandsNetworkToService(["default", "dokploy-network"]);
		expect(result).toEqual(["default", "dokploy-network"]);
	});
});
