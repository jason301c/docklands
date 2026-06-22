import { describe, expect, it } from "vitest";
import { prepareEnvironmentVariables } from "@/server/core/utils/docker/utils";

const projectEnv = `
ENVIRONMENT=staging
DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db
PORT=3000
`;
const serviceEnv = `
ENVIRONMENT=\${{workspace.ENVIRONMENT}}
DATABASE_URL=\${{workspace.DATABASE_URL}}
SERVICE_PORT=4000
`;

describe("prepareEnvironmentVariables", () => {
	it("resolves workspace variables correctly", () => {
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"ENVIRONMENT=staging",
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db",
			"SERVICE_PORT=4000",
		]);
	});

	it("resolves workspace variables as the canonical workspace-scope alias", () => {
		const workspaceServiceEnv = `
ENVIRONMENT=\${{workspace.ENVIRONMENT}}
DATABASE_URL=\${{workspace.DATABASE_URL}}
SERVICE_PORT=4000
`;

		const resolved = prepareEnvironmentVariables(
			workspaceServiceEnv,
			projectEnv,
		);

		expect(resolved).toEqual([
			"ENVIRONMENT=staging",
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db",
			"SERVICE_PORT=4000",
		]);
	});

	it("handles undefined workspace variables", () => {
		const incompleteProjectEnv = `
		NODE_ENV=production
		`;

		const invalidServiceEnv = `
		UNDEFINED_VAR=\${{workspace.UNDEFINED_VAR}}
		`;

		expect(
			() =>
				prepareEnvironmentVariables(invalidServiceEnv, incompleteProjectEnv), // Cambiado el orden
		).toThrow(
			"Invalid workspace environment variable: workspace.UNDEFINED_VAR",
		);
	});

	it("rejects the old project variable namespace", () => {
		const invalidServiceEnv = `
		OLD_VAR=\${{project.ENVIRONMENT}}
		`;

		expect(() =>
			prepareEnvironmentVariables(invalidServiceEnv, projectEnv),
		).toThrow(
			"Unsupported project environment variable namespace: project.ENVIRONMENT. Use workspace.ENVIRONMENT instead.",
		);
	});

	it("reports missing workspace variables with workspace language", () => {
		const incompleteProjectEnv = `
		NODE_ENV=production
		`;

		const invalidServiceEnv = `
		UNDEFINED_VAR=\${{workspace.UNDEFINED_VAR}}
		`;

		expect(() =>
			prepareEnvironmentVariables(invalidServiceEnv, incompleteProjectEnv),
		).toThrow(
			"Invalid workspace environment variable: workspace.UNDEFINED_VAR",
		);
	});

	it("allows service-specific variables to override workspace variables", () => {
		const serviceSpecificEnv = `
		ENVIRONMENT=production
		DATABASE_URL=\${{workspace.DATABASE_URL}}
		`;

		const resolved = prepareEnvironmentVariables(
			serviceSpecificEnv,
			projectEnv,
		);

		expect(resolved).toEqual([
			"ENVIRONMENT=production", // Overrides workspace variable
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db",
		]);
	});

	it("resolves complex references for dynamic endpoints", () => {
		const projectEnv = `
BASE_URL=https://api.example.com
API_VERSION=v1
PORT=8000
`;
		const serviceEnv = `
API_ENDPOINT=\${{workspace.BASE_URL}}/\${{workspace.API_VERSION}}/endpoint
SERVICE_PORT=9000
`;
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"API_ENDPOINT=https://api.example.com/v1/endpoint",
			"SERVICE_PORT=9000",
		]);
	});

	it("handles missing workspace variables gracefully", () => {
		const projectEnv = `
PORT=8080
`;
		const serviceEnv = `
MISSING_VAR=\${{workspace.MISSING_KEY}}
SERVICE_PORT=3000
`;

		expect(() => prepareEnvironmentVariables(serviceEnv, projectEnv)).toThrow(
			"Invalid workspace environment variable: workspace.MISSING_KEY",
		);
	});

	it("overrides workspace variables with service-specific values", () => {
		const projectEnv = `
ENVIRONMENT=staging
DATABASE_URL=postgres://project:project@localhost:5432/workspace_db
`;
		const serviceEnv = `
ENVIRONMENT=\${{workspace.ENVIRONMENT}}
DATABASE_URL=postgres://service:service@localhost:5432/service_db
SERVICE_NAME=my-service
`;
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"ENVIRONMENT=staging",
			"DATABASE_URL=postgres://service:service@localhost:5432/service_db",
			"SERVICE_NAME=my-service",
		]);
	});

	it("handles workspace variables with normal and unusual characters", () => {
		const projectEnv = `
ENVIRONMENT=PRODUCTION
`;

		// Needs to be in quotes
		const serviceEnv = `
NODE_ENV=\${{workspace.ENVIRONMENT}}
SPECIAL_VAR="$^@$^@#$^@!#$@#$-\${{workspace.ENVIRONMENT}}"
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"NODE_ENV=PRODUCTION",
			"SPECIAL_VAR=$^@$^@#$^@!#$@#$-PRODUCTION",
		]);
	});

	it("handles complex cases with multiple references, special characters, and spaces", () => {
		const projectEnv = `
ENVIRONMENT=STAGING
APP_NAME=MyApp
`;

		const serviceEnv = `
NODE_ENV=\${{workspace.ENVIRONMENT}}
COMPLEX_VAR="Prefix-$#^!@-\${{workspace.ENVIRONMENT}}--\${{workspace.APP_NAME}} Suffix "
`;
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"NODE_ENV=STAGING",
			"COMPLEX_VAR=Prefix-$#^!@-STAGING--MyApp Suffix ",
		]);
	});

	it("handles references enclosed in single quotes", () => {
		const projectEnv = `
	ENVIRONMENT=STAGING
	APP_NAME=MyApp
	`;

		const serviceEnv = `
	NODE_ENV='\${{workspace.ENVIRONMENT}}'
	COMPLEX_VAR='Prefix-$#^!@-\${{workspace.ENVIRONMENT}}--\${{workspace.APP_NAME}} Suffix'
	`;
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"NODE_ENV=STAGING",
			"COMPLEX_VAR=Prefix-$#^!@-STAGING--MyApp Suffix",
		]);
	});

	it("handles double and single quotes combined", () => {
		const projectEnv = `
ENVIRONMENT=PRODUCTION
APP_NAME=MyApp
`;
		const serviceEnv = `
NODE_ENV="'\${{workspace.ENVIRONMENT}}'"
COMPLEX_VAR="'Prefix "DoubleQuoted" and \${{workspace.APP_NAME}}'"
`;
		const resolved = prepareEnvironmentVariables(serviceEnv, projectEnv);

		expect(resolved).toEqual([
			"NODE_ENV='PRODUCTION'",
			"COMPLEX_VAR='Prefix \"DoubleQuoted\" and MyApp'",
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
