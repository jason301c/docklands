import { describe, expect, it } from "vitest";
import {
	prepareEnvironmentVariables,
	prepareEnvironmentVariablesForShell,
} from "@/server/core/utils/docker/utils";

describe("prepareEnvironmentVariables (environment-level cascade)", () => {
	it("inherits environment variables the service does not declare", () => {
		const environmentEnv = `
LOG_LEVEL=debug
SENTRY_DSN=https://sentry.example.com
`;
		const serviceEnv = `
SERVICE_PORT=4000
`;

		const resolved = prepareEnvironmentVariables(
			serviceEnv,
			"",
			environmentEnv,
		);

		expect(resolved).toEqual([
			"SERVICE_PORT=4000",
			"LOG_LEVEL=debug",
			"SENTRY_DSN=https://sentry.example.com",
		]);
	});

	it("lets a service override an inherited environment variable", () => {
		const environmentEnv = `
LOG_LEVEL=debug
`;
		const serviceEnv = `
LOG_LEVEL=info
`;

		const resolved = prepareEnvironmentVariables(
			serviceEnv,
			"",
			environmentEnv,
		);

		expect(resolved).toEqual(["LOG_LEVEL=info"]);
	});

	it("still resolves ${{environment.X}} references for renaming", () => {
		const environmentEnv = `
DB_HOST=db.internal
`;
		const serviceEnv = `
POSTGRES_HOST=\${{environment.DB_HOST}}
`;

		const resolved = prepareEnvironmentVariables(
			serviceEnv,
			"",
			environmentEnv,
		);

		// The renamed POSTGRES_HOST plus the inherited DB_HOST.
		expect(resolved).toEqual([
			"POSTGRES_HOST=db.internal",
			"DB_HOST=db.internal",
		]);
	});

	it("throws on an undefined ${{environment.X}} reference", () => {
		const serviceEnv = `
VALUE=\${{environment.MISSING}}
`;

		expect(() =>
			prepareEnvironmentVariables(serviceEnv, "", "LOG_LEVEL=debug"),
		).toThrow("Invalid environment variable: environment.MISSING");
	});

	it("throws on a malformed environment reference", () => {
		const serviceEnv = `
BAD=\${{environment.}}
`;

		expect(() =>
			prepareEnvironmentVariables(serviceEnv, "", "LOG_LEVEL=debug"),
		).toThrow("Invalid environment variable: environment.");
	});

	it("preserves special characters in inherited values", () => {
		const environmentEnv = `
JWT_SECRET="secret-with-@#%^&*() and spaces!"
`;
		const serviceEnv = `
SERVICE=api
`;

		const resolved = prepareEnvironmentVariables(
			serviceEnv,
			"",
			environmentEnv,
		);

		expect(resolved).toEqual([
			"SERVICE=api",
			"JWT_SECRET=secret-with-@#%^&*() and spaces!",
		]);
	});
});

describe("prepareEnvironmentVariables (precedence: service > environment > workspace)", () => {
	it("merges all three layers with the right precedence", () => {
		const workspaceEnv = `
TIER=workspace
ONLY_WORKSPACE=ws
SHARED=workspace-shared
`;
		const environmentEnv = `
TIER=environment
ONLY_ENVIRONMENT=env
SHARED=environment-shared
`;
		const serviceEnv = `
TIER=service
ONLY_SERVICE=svc
`;

		const resolved = prepareEnvironmentVariables(
			serviceEnv,
			workspaceEnv,
			environmentEnv,
		);

		expect(resolved).toEqual([
			"TIER=service", // service wins over environment and workspace
			"ONLY_SERVICE=svc",
			"ONLY_ENVIRONMENT=env", // inherited from environment
			"SHARED=environment-shared", // environment wins over workspace
			"ONLY_WORKSPACE=ws", // inherited from workspace
		]);
	});

	it("keeps a service-layer value (e.g. a generated connection var) over a workspace var of the same name", () => {
		const workspaceEnv = `
DATABASE_URL=postgres://workspace-default/db
`;
		// Connection variables are persisted into the service env, so they arrive
		// here as service vars and must win over an inherited workspace value.
		const serviceEnv = `
DATABASE_URL=postgres://service:service@db.internal:5432/app
`;

		const resolved = prepareEnvironmentVariables(serviceEnv, workspaceEnv, "");

		expect(resolved).toEqual([
			"DATABASE_URL=postgres://service:service@db.internal:5432/app",
		]);
	});
});

describe("prepareEnvironmentVariablesForShell (shell escaping)", () => {
	it("escapes single quotes in environment variable values", () => {
		const serviceEnv = `
ENV_VARIABLE='ENVITONME'NT'
ANOTHER_VAR='value with 'quotes' inside'
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// shell-quote should wrap these in double quotes
		expect(resolved).toEqual([
			`"ENV_VARIABLE=ENVITONME'NT"`,
			`"ANOTHER_VAR=value with 'quotes' inside"`,
		]);
	});

	it("escapes double quotes in environment variable values", () => {
		const serviceEnv = `
MESSAGE="Hello "World""
QUOTED_PATH="/path/to/"file""
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// shell-quote wraps in single quotes when there are double quotes inside
		expect(resolved).toEqual([
			`'MESSAGE=Hello "World"'`,
			`'QUOTED_PATH=/path/to/"file"'`,
		]);
	});

	it("escapes dollar signs in environment variable values", () => {
		const serviceEnv = `
PRICE=$100
VARIABLE=$HOME/path
TEMPLATE=Hello $USER
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// Dollar signs should be escaped to prevent variable expansion
		for (const env of resolved) {
			expect(env).toContain("$");
		}
	});

	it("escapes backticks in environment variable values", () => {
		const serviceEnv = `
COMMAND=\`echo "test"\`
NESTED=value with \`backticks\` inside
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// Backticks are escaped/removed by dotenv parsing, but values should be safely quoted
		expect(resolved.length).toBe(2);
		expect(resolved[0]).toContain("COMMAND");
		expect(resolved[1]).toContain("NESTED");
	});

	it("handles environment variables with spaces", () => {
		const serviceEnv = `
FULL_NAME="John Doe"
MESSAGE='Hello World'
SENTENCE=This is a test
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// shell-quote uses single quotes for strings with spaces
		expect(resolved).toEqual([
			`'FULL_NAME=John Doe'`,
			`'MESSAGE=Hello World'`,
			`'SENTENCE=This is a test'`,
		]);
	});

	it("handles environment variables with backslashes", () => {
		const serviceEnv = `
WINDOWS_PATH=C:\\Users\\Documents
ESCAPED=value\\with\\backslashes
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// Backslashes should be properly escaped
		expect(resolved.length).toBe(2);
		for (const env of resolved) {
			expect(env).toContain("\\");
		}
	});

	it("handles simple environment variables without special characters", () => {
		const serviceEnv = `
NODE_ENV=production
PORT=3000
DEBUG=true
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// shell-quote escapes the = sign in some cases
		expect(resolved).toEqual([
			"NODE_ENV\\=production",
			"PORT\\=3000",
			"DEBUG\\=true",
		]);
	});

	it("handles environment variables with mixed special characters", () => {
		const serviceEnv = `
COMPLEX='value with "double" and 'single' quotes'
BASH_COMMAND=echo "$HOME" && echo 'test'
WEIRD=\`echo "$VAR"\` with 'quotes' and "more"
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// All should be escaped, none should throw errors
		expect(resolved.length).toBe(3);
		// Verify each can be safely used in shell
		for (const env of resolved) {
			expect(typeof env).toBe("string");
			expect(env.length).toBeGreaterThan(0);
		}
	});

	it("handles environment variables with newlines", () => {
		const serviceEnv = `
MULTILINE="line1
line2
line3"
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(1);
		expect(resolved[0]).toContain("MULTILINE");
	});

	it("handles empty environment variable values", () => {
		const serviceEnv = `
EMPTY=
EMPTY_QUOTED=""
EMPTY_SINGLE=''
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		// shell-quote escapes the = sign for empty values
		expect(resolved).toEqual([
			"EMPTY\\=",
			"EMPTY_QUOTED\\=",
			"EMPTY_SINGLE\\=",
		]);
	});

	it("handles environment variables with equals signs in values", () => {
		const serviceEnv = `
EQUATION=a=b+c
CONNECTION_STRING=user=admin;password=test
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(2);
		expect(resolved[0]).toContain("EQUATION");
		expect(resolved[1]).toContain("CONNECTION_STRING");
	});

	it("resolves and escapes environment variables together", () => {
		const projectEnv = `
BASE_URL=https://example.com
API_KEY='secret-key-with-quotes'
`;

		const environmentEnv = `
ENV_NAME=production
DB_PASS='pa$$word'
`;

		const serviceEnv = `
FULL_URL=\${{workspace.BASE_URL}}/api
AUTH_KEY=\${{workspace.API_KEY}}
ENVIRONMENT=\${{environment.ENV_NAME}}
DB_PASSWORD=\${{environment.DB_PASS}}
CUSTOM='value with 'quotes' inside'
`;

		const resolved = prepareEnvironmentVariablesForShell(
			serviceEnv,
			projectEnv,
			environmentEnv,
		);

		// 5 service vars plus the inherited workspace (BASE_URL, API_KEY) and
		// environment (ENV_NAME, DB_PASS) vars they reference.
		expect(resolved.length).toBe(9);
		// All resolved values should be properly escaped
		for (const env of resolved) {
			expect(typeof env).toBe("string");
		}
	});

	it("handles environment variables with semicolons and ampersands", () => {
		const serviceEnv = `
COMMAND=echo "test" && echo "test2"
MULTIPLE=cmd1; cmd2; cmd3
URL_WITH_PARAMS=https://example.com?a=1&b=2&c=3
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(3);
		// These should be safely escaped to prevent command injection
		for (const env of resolved) {
			expect(typeof env).toBe("string");
			expect(env.length).toBeGreaterThan(0);
		}
	});

	it("handles environment variables with pipes and redirects", () => {
		const serviceEnv = `
PIPE_COMMAND=cat file | grep test
REDIRECT=echo "test" > output.txt
BOTH=cat input.txt | grep pattern > output.txt
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(3);
		// Pipes and redirects should be safely quoted
		expect(resolved[0]).toContain("PIPE_COMMAND");
		expect(resolved[1]).toContain("REDIRECT");
		expect(resolved[2]).toContain("BOTH");
		// At least one should contain a pipe
		const hasPipe = resolved.some((env) => env.includes("|"));
		expect(hasPipe).toBe(true);
	});

	it("handles environment variables with parentheses and brackets", () => {
		const serviceEnv = `
MATH=(a+b)*c
ARRAY=[1,2,3]
JSON={"key":"value"}
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(3);
		expect(resolved[0]).toContain("(");
		expect(resolved[1]).toContain("[");
		expect(resolved[2]).toContain("{");
	});

	it("handles very long environment variable values", () => {
		const longValue = "a".repeat(10000);
		const serviceEnv = `LONG_VAR=${longValue}`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(1);
		expect(resolved[0]).toContain("LONG_VAR");
		expect(resolved[0]?.length).toBeGreaterThan(10000);
	});

	it("handles special unicode characters in environment variables", () => {
		const serviceEnv = `
EMOJI=Hello 🌍 World 🚀
CHINESE=你好世界
SPECIAL=café résumé naïve
`;

		const resolved = prepareEnvironmentVariablesForShell(serviceEnv, "", "");

		expect(resolved.length).toBe(3);
		expect(resolved[0]).toContain("🌍");
		expect(resolved[1]).toContain("你好");
		expect(resolved[2]).toContain("café");
	});
});
