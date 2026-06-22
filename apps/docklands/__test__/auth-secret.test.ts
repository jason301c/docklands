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

	it("rejects missing secrets in production", () => {
		expect(() =>
			resolveBetterAuthSecret({
				NODE_ENV: "production",
			}),
		).toThrow("BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE must be set.");
	});

	it("rejects missing secrets during Next production builds", () => {
		expect(() =>
			resolveBetterAuthSecret({
				NODE_ENV: "production",
				NEXT_PHASE: "phase-production-build",
			}),
		).toThrow("BETTER_AUTH_SECRET or BETTER_AUTH_SECRET_FILE must be set.");
	});

	it("uses a deterministic test-only secret", () => {
		expect(resolveBetterAuthSecret({ NODE_ENV: "test" })).toBe(
			"docklands-test-secret-00000000000000000000",
		);
	});
});
