import { describe, expect, it } from "vitest";
import { resolveBundledPostgresCredentials } from "@/server/core/setup/postgres-setup";

describe("resolveBundledPostgresCredentials", () => {
	it("derives bundled Postgres credentials from DATABASE_URL", () => {
		expect(
			resolveBundledPostgresCredentials({
				DATABASE_URL:
					"postgres://docklands:s3cret@docklands-postgres:5432/appdb",
			}),
		).toEqual({
			user: "docklands",
			password: "s3cret",
			database: "appdb",
		});
	});

	it("derives bundled Postgres credentials from POSTGRES_PASSWORD_FILE", () => {
		expect(
			resolveBundledPostgresCredentials(
				{
					POSTGRES_PASSWORD_FILE: "/run/secrets/postgres",
				},
				() => "file-secret\n",
			),
		).toEqual({
			user: "docklands",
			password: "file-secret",
			database: "docklands",
		});
	});

	it("uses explicit Postgres user and database with POSTGRES_PASSWORD_FILE", () => {
		expect(
			resolveBundledPostgresCredentials(
				{
					POSTGRES_PASSWORD_FILE: "/run/secrets/postgres",
					POSTGRES_USER: "operator",
					POSTGRES_DB: "control_plane",
				},
				() => "file-secret",
			),
		).toEqual({
			user: "operator",
			password: "file-secret",
			database: "control_plane",
		});
	});

	it("rejects an empty password file", () => {
		expect(() =>
			resolveBundledPostgresCredentials(
				{
					POSTGRES_PASSWORD_FILE: "/run/secrets/postgres",
				},
				() => "\n",
			),
		).toThrow("POSTGRES_PASSWORD_FILE is readable but empty");
	});
});
