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

	it("rejects missing database credentials in production runtime", () => {
		expect(() =>
			resolveDbUrl({
				NODE_ENV: "production",
			}),
		).toThrow("DATABASE_URL or POSTGRES_PASSWORD_FILE must be set");
	});

	it("keeps build-time compatibility for Next production builds", () => {
		expect(
			resolveDbUrl({
				NODE_ENV: "production",
				NEXT_PHASE: "phase-production-build",
			}),
		).toBe(
			"postgres://docklands:amukds4wi9001583845717ad2@docklands-postgres:5432/docklands",
		);
	});
});
