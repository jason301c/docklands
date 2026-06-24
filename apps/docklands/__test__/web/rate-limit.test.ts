import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkRateLimit,
	clientIpFromHeaders,
} from "../../server/web/rate-limit";

/**
 * Fixed-window in-memory rate limiter guarding the unauthenticated HTTP surfaces
 * (deploy webhooks). The limiter bucket map is module-global, so each test uses
 * a unique key to avoid cross-test bleed.
 */

// Unique key per test so the global bucket map never collides between cases.
let counter = 0;
const uniqueKey = () => `key-${Date.now()}-${counter++}`;

describe("checkRateLimit", () => {
	it("allows exactly `limit` calls in the window, then rejects", () => {
		const key = uniqueKey();
		const limit = 3;
		const windowMs = 60_000;

		// First `limit` calls pass.
		expect(checkRateLimit(key, limit, windowMs)).toBe(true);
		expect(checkRateLimit(key, limit, windowMs)).toBe(true);
		expect(checkRateLimit(key, limit, windowMs)).toBe(true);
		// The (limit + 1)th call within the window is rejected.
		expect(checkRateLimit(key, limit, windowMs)).toBe(false);
		// Still rejected on subsequent calls.
		expect(checkRateLimit(key, limit, windowMs)).toBe(false);
	});

	it("allows the very first call even with limit 1, rejects the second", () => {
		const key = uniqueKey();
		expect(checkRateLimit(key, 1, 60_000)).toBe(true);
		expect(checkRateLimit(key, 1, 60_000)).toBe(false);
	});

	it("treats distinct keys as independent buckets", () => {
		const a = uniqueKey();
		const b = uniqueKey();
		const limit = 1;
		const windowMs = 60_000;

		expect(checkRateLimit(a, limit, windowMs)).toBe(true);
		// a is now exhausted...
		expect(checkRateLimit(a, limit, windowMs)).toBe(false);
		// ...but b is untouched.
		expect(checkRateLimit(b, limit, windowMs)).toBe(true);
		expect(checkRateLimit(b, limit, windowMs)).toBe(false);
	});

	describe("window expiry (fake timers)", () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it("resets the bucket once the window elapses", () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

			const key = uniqueKey();
			const limit = 2;
			const windowMs = 1_000;

			expect(checkRateLimit(key, limit, windowMs)).toBe(true);
			expect(checkRateLimit(key, limit, windowMs)).toBe(true);
			// Exhausted within the window.
			expect(checkRateLimit(key, limit, windowMs)).toBe(false);

			// Advance past the window -> now >= resetAt -> fresh bucket.
			vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
			expect(checkRateLimit(key, limit, windowMs)).toBe(true);
			expect(checkRateLimit(key, limit, windowMs)).toBe(true);
			expect(checkRateLimit(key, limit, windowMs)).toBe(false);
		});
	});
});

describe("clientIpFromHeaders", () => {
	it("reads the first entry of x-forwarded-for", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178",
		});
		expect(clientIpFromHeaders(headers)).toBe("203.0.113.7");
	});

	it("trims whitespace around the first x-forwarded-for entry", () => {
		const headers = new Headers({
			"x-forwarded-for": "  203.0.113.9  , 10.0.0.1",
		});
		expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
	});

	it("falls back to x-real-ip when x-forwarded-for is absent", () => {
		const headers = new Headers({ "x-real-ip": "198.51.100.5" });
		expect(clientIpFromHeaders(headers)).toBe("198.51.100.5");
	});

	it("trims x-real-ip", () => {
		const headers = new Headers({ "x-real-ip": "  198.51.100.6  " });
		expect(clientIpFromHeaders(headers)).toBe("198.51.100.6");
	});

	it("prefers x-forwarded-for over x-real-ip when both are present", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.1",
			"x-real-ip": "198.51.100.1",
		});
		expect(clientIpFromHeaders(headers)).toBe("203.0.113.1");
	});

	it("falls back to 'unknown' when no proxy headers are present", () => {
		expect(clientIpFromHeaders(new Headers())).toBe("unknown");
	});

	it("falls back to 'unknown' when the first x-forwarded-for entry is blank", () => {
		const headers = new Headers({ "x-forwarded-for": "   , 10.0.0.1" });
		// First entry trims to "" which is falsy, so it short-circuits to "unknown"
		// rather than walking to the second entry.
		expect(clientIpFromHeaders(headers)).toBe("unknown");
	});
});
