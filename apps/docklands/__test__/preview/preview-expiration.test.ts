import { describe, expect, it } from "vitest";
import { computePreviewExpiresAt } from "@/server/core/services/preview-deployment";

describe("computePreviewExpiresAt", () => {
	it("returns null when expiry is disabled (0)", () => {
		expect(computePreviewExpiresAt(0)).toBeNull();
	});

	it("returns null for null/undefined", () => {
		expect(computePreviewExpiresAt(null)).toBeNull();
		expect(computePreviewExpiresAt(undefined)).toBeNull();
	});

	it("returns null for a negative window", () => {
		expect(computePreviewExpiresAt(-5)).toBeNull();
	});

	it("returns a future ISO timestamp for a positive window", () => {
		const before = Date.now();
		const result = computePreviewExpiresAt(7);
		expect(result).not.toBeNull();
		const expiresAt = new Date(result as string).getTime();
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		// Within a small tolerance of now + 7 days.
		expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDays - 1000);
		expect(expiresAt).toBeLessThanOrEqual(Date.now() + sevenDays + 1000);
	});

	it("scales with the number of days", () => {
		const oneDay = new Date(computePreviewExpiresAt(1) as string).getTime();
		const tenDays = new Date(computePreviewExpiresAt(10) as string).getTime();
		expect(tenDays).toBeGreaterThan(oneDay);
	});
});
