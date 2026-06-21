import { describe, expect, it } from "vitest";
import { resolveBetterAuthSecret } from "@/server/core/lib/auth-secret";

describe("resolveBetterAuthSecret", () => {
	it("uses BETTER_AUTH_SECRET when it is set", () => {
		expect(
			resolveBetterAuthSecret({
				BETTER_AUTH_SECRET: "x".repeat(48),
				NODE_ENV: "production",
			}),
		).toBe("x".repeat(48));
	});

	it("rejects missing secrets in production runtime", () => {
		expect(() =>
			resolveBetterAuthSecret({
				NODE_ENV: "production",
			}),
		).toThrow("BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE must be set");
	});

	it("keeps build-time compatibility for Next production builds", () => {
		expect(
			resolveBetterAuthSecret({
				NODE_ENV: "production",
				NEXT_PHASE: "phase-production-build",
			}),
		).toBe("better-auth-secret-123456789");
	});
});
