import { parse } from "shell-quote";
import { describe, expect, it } from "vitest";
import {
	getMariadbBackupCommand,
	getMongoBackupCommand,
	getMysqlBackupCommand,
	getPostgresBackupCommand,
	getS3CredentialEnv,
} from "@/server/core/utils/backups/utils";
import {
	getMariadbRestoreCommand,
	getMongoRestoreCommand,
	getMysqlRestoreCommand,
	getPostgresRestoreCommand,
} from "@/server/core/utils/restore/utils";

// A value that, interpolated naively into a shell command, would break out and
// run an extra command. After shell-quote escaping it must remain a single,
// inert argument — i.e. no command separator can reach the shell that runs it.
const INJECTION = "db'; touch /pwned; echo '";

/**
 * True iff the command, as the outer shell would parse it, contains an injected
 * command separator at the top level (`;`, `&&`, `||`, `|`). The legit backup
 * commands keep all of those *inside* a quoted `bash -c`/`sh -c` argument, so a
 * top-level separator means a payload broke out of its quoting.
 */
const hasTopLevelControlOperator = (command: string): boolean =>
	parse(command).some(
		(token) =>
			typeof token === "object" &&
			token !== null &&
			"op" in token &&
			[";", "&&", "||", "|", "&"].includes(token.op),
	);

describe("shell-injection hardening: backup command builders", () => {
	it("neutralizes a malicious database name (postgres)", () => {
		expect(
			hasTopLevelControlOperator(getPostgresBackupCommand(INJECTION, "u")),
		).toBe(false);
	});

	it("neutralizes a malicious password (mysql)", () => {
		expect(
			hasTopLevelControlOperator(getMysqlBackupCommand("db", INJECTION)),
		).toBe(false);
	});

	it("neutralizes a malicious user/password (mariadb)", () => {
		expect(
			hasTopLevelControlOperator(
				getMariadbBackupCommand("db", INJECTION, INJECTION),
			),
		).toBe(false);
	});

	it("neutralizes a malicious value (mongo)", () => {
		expect(
			hasTopLevelControlOperator(
				getMongoBackupCommand(INJECTION, "u", INJECTION),
			),
		).toBe(false);
	});

	it("escapes S3 credentials in the rclone env prefix", () => {
		const env = getS3CredentialEnv({
			accessKey: INJECTION,
			secretAccessKey: INJECTION,
		} as Parameters<typeof getS3CredentialEnv>[0]);
		expect(hasTopLevelControlOperator(`${env} rclone copyto`)).toBe(false);
	});

	it("still produces a usable command for benign input", () => {
		const cmd = getPostgresBackupCommand("appdb", "appuser");
		expect(cmd).toContain("pg_dump");
		expect(cmd).toContain("appdb");
		expect(cmd).toContain("appuser");
		expect(hasTopLevelControlOperator(cmd)).toBe(false);
	});
});

describe("shell-injection hardening: restore command builders", () => {
	it("neutralizes a malicious database name (postgres)", () => {
		expect(
			hasTopLevelControlOperator(getPostgresRestoreCommand(INJECTION, "u")),
		).toBe(false);
	});

	it("neutralizes a malicious password (mysql)", () => {
		expect(
			hasTopLevelControlOperator(getMysqlRestoreCommand("db", INJECTION)),
		).toBe(false);
	});

	it("neutralizes a malicious user/password (mariadb)", () => {
		expect(
			hasTopLevelControlOperator(
				getMariadbRestoreCommand("db", INJECTION, INJECTION),
			),
		).toBe(false);
	});

	it("neutralizes a malicious value (mongo)", () => {
		expect(
			hasTopLevelControlOperator(
				getMongoRestoreCommand(INJECTION, "u", INJECTION),
			),
		).toBe(false);
	});
});
