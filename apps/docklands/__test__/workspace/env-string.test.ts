import { describe, expect, it } from "vitest";
import {
	parseEnvironmentVariables,
	upsertEnvironmentVariables,
} from "@/shared/env-string";

describe("parseEnvironmentVariables", () => {
	it("extracts valid keys without requiring values to be visible", () => {
		expect(
			parseEnvironmentVariables(
				[
					"# workspace",
					"PORT=3000",
					"export DATABASE_URL=postgres://user:password@db:5432/app",
					'QUOTED="hello=world"',
				].join("\n"),
			),
		).toEqual([
			{ key: "PORT", value: "3000" },
			{
				key: "DATABASE_URL",
				value: "postgres://user:password@db:5432/app",
			},
			{ key: "QUOTED", value: '"hello=world"' },
		]);
	});

	it("ignores comments, blank lines, invalid keys, and malformed lines", () => {
		expect(
			parseEnvironmentVariables(
				[
					"",
					" # comment",
					"NOT_A_PAIR",
					"1_BAD=value",
					"BAD-KEY=value",
					"GOOD_KEY=value",
				].join("\n"),
			),
		).toEqual([{ key: "GOOD_KEY", value: "value" }]);
	});
});

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
