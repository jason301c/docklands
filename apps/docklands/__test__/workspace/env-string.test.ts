import { describe, expect, it } from "vitest";
import { upsertEnvironmentVariables } from "@/shared/env-string";

describe("upsertEnvironmentVariables", () => {
	it("appends variables to an empty env string", () => {
		expect(
			upsertEnvironmentVariables(null, [
				{
					key: "DATABASE_URL",
					value: "postgres://postgres:secret@db:5432/app",
				},
			]),
		).toBe("DATABASE_URL=postgres://postgres:secret@db:5432/app");
	});

	it("replaces existing keys without duplicating them", () => {
		expect(
			upsertEnvironmentVariables("PORT=3000\nDATABASE_URL=old", [
				{ key: "DATABASE_URL", value: "postgres://new" },
			]),
		).toBe("PORT=3000\nDATABASE_URL=postgres://new");
	});

	it("leaves unrelated comments and values in place", () => {
		expect(
			upsertEnvironmentVariables("# app config\nPORT=3000", [
				{ key: "REDIS_URL", value: "redis://:secret@redis:6379" },
			]),
		).toBe("# app config\nPORT=3000\nREDIS_URL=redis://:secret@redis:6379");
	});
});
