import { describe, expect, it } from "vitest";
import { resolveDbUrl } from "@/server/core/db/constants";

describe("resolveDbUrl", () => {
	it("uses DATABASE_URL when it is set", () => {
		expect(
			resolveDbUrl({
				DATABASE_URL: "postgres://user:pass@example.com:5432/app",
				NODE_ENV: "production",
			}),
		).toBe("postgres://user:pass@example.com:5432/app");
	});

	it("rejects missing database credentials in production", () => {
		expect(() =>
			resolveDbUrl({
				NODE_ENV: "production",
			}),
		).toThrow("DATABASE_URL or POSTGRES_PASSWORD_FILE must be set.");
	});

	it("rejects missing database credentials during Next production builds", () => {
		expect(() =>
			resolveDbUrl({
				NODE_ENV: "production",
				NEXT_PHASE: "phase-production-build",
			}),
		).toThrow("DATABASE_URL or POSTGRES_PASSWORD_FILE must be set.");
	});

	it("uses a deterministic test-only database URL", () => {
		expect(resolveDbUrl({ NODE_ENV: "test" })).toBe(
			"postgres://docklands:test@localhost:5432/docklands_test",
		);
	});
});
