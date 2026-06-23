import { describe, expect, it } from "vitest";
import { getEnvironmentVariablesObject } from "@/server/core/utils/docker/utils";

describe("getEnvironmentVariablesObject (Stack compose cascade)", () => {
	it("inherits workspace and environment variables into the stack env", () => {
		const workspaceEnv = `
COMPANY=acme
`;
		const environmentEnv = `
LOG_LEVEL=debug
`;
		const serviceEnv = `
SERVICE=api
`;

		const result = getEnvironmentVariablesObject(
			serviceEnv,
			workspaceEnv,
			environmentEnv,
		);

		expect(result).toEqual({
			SERVICE: "api",
			LOG_LEVEL: "debug",
			COMPANY: "acme",
		});
	});

	it("resolves ${{workspace.X}} and ${{environment.Y}} references", () => {
		const workspaceEnv = `
DATABASE_URL=postgres://postgres:postgres@localhost:5432/workspace_db
`;
		const environmentEnv = `
NODE_ENV=development
`;
		const serviceEnv = `
DB=\${{workspace.DATABASE_URL}}
ENV=\${{environment.NODE_ENV}}
`;

		const result = getEnvironmentVariablesObject(
			serviceEnv,
			workspaceEnv,
			environmentEnv,
		);

		expect(result).toEqual({
			DB: "postgres://postgres:postgres@localhost:5432/workspace_db",
			ENV: "development",
			DATABASE_URL: "postgres://postgres:postgres@localhost:5432/workspace_db",
			NODE_ENV: "development",
		});
	});

	it("resolves multiple environment references in a single value", () => {
		const environmentEnv = `
HOST=localhost
PORT=5432
USERNAME=postgres
PASSWORD=secret123
`;
		const serviceEnv = `
DATABASE_URL=postgresql://\${{environment.USERNAME}}:\${{environment.PASSWORD}}@\${{environment.HOST}}:\${{environment.PORT}}/mydb
`;

		const result = getEnvironmentVariablesObject(
			serviceEnv,
			"",
			environmentEnv,
		);

		expect(result).toEqual({
			DATABASE_URL: "postgresql://postgres:secret123@localhost:5432/mydb",
			HOST: "localhost",
			PORT: "5432",
			USERNAME: "postgres",
			PASSWORD: "secret123",
		});
	});

	it("throws for an undefined environment reference", () => {
		const serviceEnv = `
UNDEFINED_VAR=\${{environment.UNDEFINED_VAR}}
`;

		expect(() =>
			getEnvironmentVariablesObject(serviceEnv, "", "LOG_LEVEL=debug"),
		).toThrow("Invalid environment variable: environment.UNDEFINED_VAR");
	});

	it("maintains precedence: service > environment > workspace", () => {
		const workspaceEnv = `
TIER=workspace
SHARED=workspace-shared
`;
		const environmentEnv = `
TIER=environment
SHARED=environment-shared
ONLY_ENV=env
`;
		const serviceEnv = `
TIER=service
`;

		const result = getEnvironmentVariablesObject(
			serviceEnv,
			workspaceEnv,
			environmentEnv,
		);

		expect(result).toEqual({
			TIER: "service",
			SHARED: "environment-shared",
			ONLY_ENV: "env",
		});
	});
});
