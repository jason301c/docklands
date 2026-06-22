import { describe, expect, it } from "vitest";
import {
	formatPostgresConnectionFailure,
	isFatalPostgresConfigError,
	resolvePostgresTargetFromUrl,
} from "@/server/ops/postgres-wait";

describe("postgres wait diagnostics", () => {
	it("parses the configured database target without leaking the password", () => {
		expect(
			resolvePostgresTargetFromUrl(
				"postgres://docklands:secret@localhost:5432/docklands",
			),
		).toEqual({
			host: "localhost",
			port: 5432,
			database: "docklands",
			user: "docklands",
		});
	});

	it("treats missing role and database errors as fatal configuration issues", () => {
		expect(
			isFatalPostgresConfigError(
				Object.assign(new Error('role "docklands" does not exist'), {
					code: "28000",
				}),
			),
		).toBe(true);
		expect(
			isFatalPostgresConfigError(
				Object.assign(new Error('database "docklands" does not exist'), {
					code: "3D000",
				}),
			),
		).toBe(true);
		expect(
			isFatalPostgresConfigError(
				new Error("the database system is starting up"),
			),
		).toBe(false);
	});

	it("prints an actionable local setup hint for fatal connection failures", () => {
		const target = resolvePostgresTargetFromUrl(
			"postgres://docklands:secret@localhost:5432/docklands",
		);
		const message = formatPostgresConnectionFailure(
			Object.assign(new Error('role "docklands" does not exist'), {
				code: "28000",
			}),
			target,
		);

		expect(message).toContain("DATABASE_URL could not connect as docklands");
		expect(message).toContain("NODE_ENV=development pnpm setup");
		expect(message).not.toContain("secret");
	});
});
