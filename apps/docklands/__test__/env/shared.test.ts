import { describe, expect, it } from "vitest";
import { prepareEnvironmentVariables } from "@/server/core/utils/docker/utils";

describe("prepareEnvironmentVariables (workspace-level cascade)", () => {
	it("inherits workspace variables the service does not declare", () => {
		const workspaceEnv = `
COMPANY=acme
REGION=us-east-1
`;
		const serviceEnv = `
SERVICE_PORT=4000
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv);

		expect(resolved).toEqual([
			"SERVICE_PORT=4000",
			"COMPANY=acme",
			"REGION=us-east-1",
		]);
	});

	it("still resolves ${{workspace.X}} references", () => {
		const workspaceEnv = `
DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db
`;
		const serviceEnv = `
DB=\${{workspace.DATABASE_URL}}
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv);

		expect(resolved).toEqual([
			"DB=postgres://postgres:postgres@localhost:5432/workspace_db",
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db",
		]);
	});

	it("lets a service override an inherited workspace variable", () => {
		const workspaceEnv = `
ENVIRONMENT=staging
`;
		const serviceEnv = `
ENVIRONMENT=production
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv);

		expect(resolved).toEqual(["ENVIRONMENT=production"]);
	});

	it("throws on an undefined ${{workspace.X}} reference", () => {
		const serviceEnv = `
VALUE=\${{workspace.MISSING}}
`;

		expect(() =>
			prepareEnvironmentVariables(serviceEnv, "COMPANY=acme"),
		).toThrow("Invalid workspace environment variable: workspace.MISSING");
	});

	it("rejects the old project.* namespace", () => {
		const serviceEnv = `
OLD=\${{project.ENVIRONMENT}}
`;

		expect(() =>
			prepareEnvironmentVariables(serviceEnv, "ENVIRONMENT=staging"),
		).toThrow(
			"Unsupported workspace environment variable namespace: project.ENVIRONMENT. Use workspace.ENVIRONMENT instead.",
		);
	});

	it("resolves complex references composed from workspace variables", () => {
		const workspaceEnv = `
BASE_URL=https://api.example.com
API_VERSION=v1
`;
		const serviceEnv = `
API_ENDPOINT=\${{workspace.BASE_URL}}/\${{workspace.API_VERSION}}/endpoint
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv);

		expect(resolved).toEqual([
			"API_ENDPOINT=https://api.example.com/v1/endpoint",
			"BASE_URL=https://api.example.com",
			"API_VERSION=v1",
		]);
	});

	it("preserves quotes and special characters when resolving references", () => {
		const workspaceEnv = `
ENVIRONMENT=PRODUCTION
APP_NAME=MyApp
`;
		const serviceEnv = `
COMPLEX_VAR="Prefix-$#^!@-\${{workspace.ENVIRONMENT}}--\${{workspace.APP_NAME}} Suffix "
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv);

		expect(resolved).toEqual([
			"COMPLEX_VAR=Prefix-$#^!@-PRODUCTION--MyApp Suffix ",
			"ENVIRONMENT=PRODUCTION",
			"APP_NAME=MyApp",
		]);
	});
});

describe("prepareEnvironmentVariables (self references)", () => {
	it("resolves self references correctly", () => {
		const serviceEnv = `
ENVIRONMENT=staging
DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db
SELF_REF=\${{ENVIRONMENT}}
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, "");

		expect(resolved).toEqual([
			"ENVIRONMENT=staging",
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db",
			"SELF_REF=staging",
		]);
	});

	it("throws on undefined self references", () => {
		const serviceEnv = `
MISSING_VAR=\${{UNDEFINED_VAR}}
`;

		expect(() => prepareEnvironmentVariables(serviceEnv, "")).toThrow(
			"Invalid service environment variable: UNDEFINED_VAR",
		);
	});

	it("allows overriding and still resolving from self", () => {
		const serviceEnv = `
ENVIRONMENT=production
OVERRIDE_ENV=\${{ENVIRONMENT}}
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, "");

		expect(resolved).toEqual([
			"ENVIRONMENT=production",
			"OVERRIDE_ENV=production",
		]);
	});

	it("resolves multiple self references inside one value", () => {
		const serviceEnv = `
ENVIRONMENT=staging
APP_NAME=MyApp
COMPLEX=\${{APP_NAME}}-\${{ENVIRONMENT}}-\${{APP_NAME}}
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, "");

		expect(resolved).toEqual([
			"ENVIRONMENT=staging",
			"APP_NAME=MyApp",
			"COMPLEX=MyApp-staging-MyApp",
		]);
	});

	it("handles quotes with self references", () => {
		const serviceEnv = `
ENVIRONMENT=production
QUOTED="'\${{ENVIRONMENT}}'"
MIXED=""Double \${{ENVIRONMENT}}""
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, "");

		expect(resolved).toEqual([
			"ENVIRONMENT=production",
			"QUOTED='production'",
			'MIXED="Double production"',
		]);
	});
});
