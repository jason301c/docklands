import { describe, expect, it } from "vitest";
import { findZoneForHost } from "@/server/core/services/cloudflare";

const zones = [
	{ id: "z-example", name: "example.com" },
	{ id: "z-sub", name: "team.example.com" },
	{ id: "z-other", name: "other.org" },
];

describe("findZoneForHost", () => {
	it("matches the apex domain exactly", () => {
		expect(findZoneForHost(zones, "example.com")?.id).toBe("z-example");
	});

	it("matches a subdomain to its zone", () => {
		expect(findZoneForHost(zones, "docs.example.com")?.id).toBe("z-example");
	});

	it("prefers the most specific (longest) matching zone", () => {
		// Both "example.com" and "team.example.com" are suffixes; the longer wins.
		expect(findZoneForHost(zones, "api.team.example.com")?.id).toBe("z-sub");
	});

	it("returns null when no zone owns the host", () => {
		expect(findZoneForHost(zones, "app.unknown.dev")).toBeNull();
	});

	it("does not treat a non-dot suffix as a match", () => {
		// "notexample.com" ends with "example.com" textually but is a different
		// registrable domain — it must not match.
		expect(findZoneForHost(zones, "notexample.com")).toBeNull();
	});

	it("returns null for an empty host", () => {
		expect(findZoneForHost(zones, "")).toBeNull();
	});
});
