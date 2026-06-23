import { describe, expect, it } from "vitest";
import {
	detectDatabaseEngine,
	isDatabaseImage,
} from "@/server/core/databases/detection";

describe("database detection", () => {
	describe("bare images (no context)", () => {
		it.each([
			["postgres:16", "postgres"],
			["postgres", "postgres"],
			["docker.io/library/postgres:16", "postgres"],
			["postgis/postgis:16-3.4", "postgres"],
			["mysql:8", "mysql"],
			["mariadb:11", "mariadb"],
			["mongo:8", "mongo"],
			["redis:7", "redis"],
			["ghcr.io/tursodatabase/libsql-server:v0.24.32", "libsql"],
		])("%s -> %s", (image, expected) => {
			expect(detectDatabaseEngine(image)).toBe(expected);
		});

		it("returns null for non-database images", () => {
			expect(detectDatabaseEngine("nginx:latest")).toBeNull();
			expect(detectDatabaseEngine("node:24")).toBeNull();
			expect(detectDatabaseEngine(null)).toBeNull();
			expect(detectDatabaseEngine(undefined)).toBeNull();
		});
	});

	describe("contextual disambiguation (Coolify known-app denylist)", () => {
		it("treats postgres-named applications as NOT databases", () => {
			expect(
				detectDatabaseEngine("postgrest/postgrest:latest", {
					image: "postgrest/postgrest:latest",
				}),
			).toBeNull();
			expect(
				detectDatabaseEngine("supabase/postgres-meta:v0.80", {
					image: "supabase/postgres-meta:v0.80",
				}),
			).toBeNull();
			expect(
				detectDatabaseEngine("metabase/metabase:latest", {
					image: "metabase/metabase:latest",
				}),
			).toBeNull();
		});

		it("a real postgres with db env vars is still detected", () => {
			expect(
				detectDatabaseEngine("postgres:16", {
					image: "postgres:16",
					environment: ["POSTGRES_PASSWORD=secret", "POSTGRES_DB=app"],
					ports: ["5432:5432"],
				}),
			).toBe("postgres");
		});

		it("a database-named image with only app signals is rejected", () => {
			// image base 'redis' matches, but the service looks like an app
			expect(
				detectDatabaseEngine("redis", {
					image: "redis",
					environment: ["APP_ENV=production", "API_KEYS=abc"],
				}),
			).toBeNull();
		});

		it("a healthcheck signal confirms a database", () => {
			expect(
				detectDatabaseEngine("postgres:16", {
					image: "postgres:16",
					healthcheck: { test: ["CMD", "pg_isready", "-U", "admin"] },
				}),
			).toBe("postgres");
		});
	});

	describe("isDatabaseImage convenience wrapper", () => {
		it("matches detectDatabaseEngine truthiness", () => {
			expect(isDatabaseImage("postgres:16")).toBe(true);
			expect(isDatabaseImage("nginx")).toBe(false);
		});
	});
});
