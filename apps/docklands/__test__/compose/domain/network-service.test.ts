import { describe, expect, it } from "vitest";
import { addDocklandsNetworkToService } from "@/server/core/utils/docker/domain";

describe("addDocklandsNetworkToService", () => {
	it("should add network to an empty array", () => {
		const result = addDocklandsNetworkToService([]);
		expect(result).toEqual(["docklands-network", "default"]);
	});

	it("should not add duplicate network to an array", () => {
		const result = addDocklandsNetworkToService(["docklands-network"]);
		expect(result).toEqual(["docklands-network", "default"]);
	});

	it("should add network to an existing array with other networks", () => {
		const result = addDocklandsNetworkToService(["other-network"]);
		expect(result).toEqual(["other-network", "docklands-network", "default"]);
	});

	it("should add network to an object if networks is an object", () => {
		const result = addDocklandsNetworkToService({ "other-network": {} });
		expect(result).toEqual({
			"other-network": {},
			"docklands-network": {},
			default: {},
		});
	});

	it("should not duplicate default network when already present", () => {
		const result = addDocklandsNetworkToService([
			"default",
			"docklands-network",
		]);
		expect(result).toEqual(["default", "docklands-network"]);
	});
});
