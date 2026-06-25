import { describe, expect, it } from "vitest";
import { validateProductionSecrets } from "@/server/ops/check-secrets";

const validEncryptionKey = Buffer.alloc(32, 9).toString("base64");

const validEnv = {
	BETTER_AUTH_SECRET: "docklands-production-secret-000000000000",
	DOCKLANDS_ENCRYPTION_KEY: validEncryptionKey,
	DATABASE_URL: "postgres://docklands:secret@db.internal:5432/docklands",
};

const problemNames = (problems: ReturnType<typeof validateProductionSecrets>) =>
	problems.map((problem) => problem.name);

describe("validateProductionSecrets", () => {
	it("accepts explicit production secret environment variables", () => {
		expect(validateProductionSecrets(validEnv)).toEqual([]);
	});

	it("accepts readable non-empty file sources", () => {
		const secrets = new Map([
			["/run/secrets/auth", "docklands-production-secret-000000000000"],
			["/run/secrets/encryption", validEncryptionKey],
			["/run/secrets/postgres", "postgres-password"],
		]);

		expect(
			validateProductionSecrets(
				{
					BETTER_AUTH_SECRET_FILE: "/run/secrets/auth",
					DOCKLANDS_ENCRYPTION_KEY_FILE: "/run/secrets/encryption",
					POSTGRES_PASSWORD_FILE: "/run/secrets/postgres",
				},
				(path) => {
					const value = secrets.get(path);
					if (!value) {
						throw new Error("missing test secret");
					}
					return value;
				},
			),
		).toEqual([]);
	});

	it("rejects unreadable secret files", () => {
		const problems = validateProductionSecrets(
			{
				BETTER_AUTH_SECRET_FILE: "/run/secrets/auth",
				DOCKLANDS_ENCRYPTION_KEY: validEncryptionKey,
				DATABASE_URL: validEnv.DATABASE_URL,
			},
			() => {
				throw new Error("permission denied");
			},
		);

		expect(problemNames(problems)).toContain("BETTER_AUTH_SECRET_FILE");
		expect(problems[0]?.message).toContain("permission denied");
	});

	it("rejects an encryption key with the wrong decoded length", () => {
		const problems = validateProductionSecrets({
			...validEnv,
			DOCKLANDS_ENCRYPTION_KEY: Buffer.alloc(16, 9).toString("base64"),
		});

		expect(problemNames(problems)).toContain("DOCKLANDS_ENCRYPTION_KEY");
		expect(problems[0]?.message).toContain("32 bytes");
	});

	it("rejects ambiguous database secret sources", () => {
		const problems = validateProductionSecrets({
			...validEnv,
			POSTGRES_PASSWORD_FILE: "/run/secrets/postgres",
		});

		expect(problemNames(problems)).toContain("DATABASE_URL");
		expect(problems[0]?.message).toContain("not both");
	});

	it("rejects invalid database URLs without printing the URL", () => {
		const problems = validateProductionSecrets({
			...validEnv,
			DATABASE_URL: "https://docklands:secret@example.com/docklands",
		});

		expect(problemNames(problems)).toContain("DATABASE_URL");
		expect(problems[0]?.message).toContain("postgres://");
		expect(problems[0]?.message).not.toContain("secret");
	});

	it("reports all missing production secret groups", () => {
		expect(problemNames(validateProductionSecrets({}))).toEqual([
			"Encryption key",
			"Better Auth secret",
			"DATABASE_URL",
		]);
	});
});
