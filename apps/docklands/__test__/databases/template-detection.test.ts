import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { processComposeTemplate } from "@/server/core/templates/processors";

const fixture = readFileSync(
	fileURLToPath(
		new URL("../../templates/test-database-detection.yaml", import.meta.url),
	),
	"utf8",
);

const options = {
	appName: "detect-test",
	serverIp: "127.0.0.1",
	projectName: "detect-test",
};

describe("template database detection (bridge)", () => {
	const result = processComposeTemplate(fixture, options);
	const byService = new Map(
		result.databases.map((d) => [d.serviceName, d.engine]),
	);

	it("detects the standard managed databases with the right engine", () => {
		expect(byService.get("database-postgres-main")).toBe("postgres");
		expect(byService.get("database-mysql-main")).toBe("mysql");
		expect(byService.get("database-mongodb-main")).toBe("mongo");
		expect(byService.get("database-redis-main")).toBe("redis");
		expect(byService.get("database-postgres-custom-port")).toBe("postgres");
		expect(byService.get("database-mariadb")).toBe("mariadb");
	});

	it("extracts credentials from the detected database's env (bridge)", () => {
		// fixture: database-postgres-main has POSTGRES_USER/PASSWORD/DB set
		const pg = result.databases.find(
			(d) => d.serviceName === "database-postgres-main",
		);
		expect(pg?.config).toMatchObject({
			databaseUser: "admin",
			databasePassword: "secret123",
			databaseName: "maindb",
		});
	});

	it("does NOT flag applications that merely embed a database keyword", () => {
		// Coolify known-app denylist + base-name mismatch cases
		expect(byService.has("application-supertokens")).toBe(false);
		expect(byService.has("application-metabase")).toBe(false);
		expect(byService.has("application-nocodb")).toBe(false);
		expect(byService.has("application-postgrest")).toBe(false);
		expect(byService.has("application-umami-postgresql")).toBe(false);
		expect(byService.has("application-infisical-postgres")).toBe(false);
		expect(byService.has("application-fake-postgres-client")).toBe(false);
		expect(byService.has("application-redis-commander")).toBe(false);
		expect(byService.has("application-mongo-express")).toBe(false);
		expect(byService.has("application-nginx")).toBe(false);
		expect(byService.has("application-node-app")).toBe(false);
	});

	it("does not flag plain web apps as databases", () => {
		expect(byService.has("application-webapp-external-db")).toBe(false);
	});
});
