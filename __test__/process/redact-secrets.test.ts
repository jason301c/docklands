import { describe, expect, it } from "vitest";
import {
	redactErrorSecrets,
	redactSecrets,
} from "@/server/core/utils/process/redactSecrets";

// All key material below is synthetic: these base64 strings decode to the
// literal text "synthetic-test-not-a-real-...-key" and are not real keys.

describe("redactSecrets", () => {
	it("redacts a PEM private key block written to /tmp/id_rsa", () => {
		const secret = "c3ludGhldGljLXRlc3Qtbm90LWEtcmVhbC1wcml2YXRlLWtleQ==";
		const command =
			`echo "-----BEGIN OPENSSH PRIVATE KEY-----\n${secret}\n-----END OPENSSH PRIVATE KEY-----" > /tmp/id_rsa;` +
			"chmod 600 /tmp/id_rsa;git clone --branch main --depth 1 git@example.com:org/repo /code";

		const redacted = redactSecrets(command);

		expect(redacted).not.toContain(secret);
		expect(redacted).toContain("[REDACTED PRIVATE KEY]");
		expect(redacted).toContain("chmod 600 /tmp/id_rsa");
		expect(redacted).toContain("git clone --branch main");
	});

	it("redacts a base64 key piped to base64 -d", () => {
		const secret = "c3ludGhldGljLXRlc3Qtbm90LWEtcmVhbC1jZXJ0LWtleQ==";
		const command = `echo "${secret}" | base64 -d > "/etc/docklands/cert.key";`;

		const redacted = redactSecrets(command);

		expect(redacted).not.toContain(secret);
		expect(redacted).toContain('echo "[REDACTED]" | base64 -d');
	});

	it("leaves commands without secrets untouched", () => {
		const command =
			"git clone --branch main --depth 1 git@github.com:org/repo.git /tmp/code";

		expect(redactSecrets(command)).toBe(command);
	});

	it("redacts secrets from original exec error output properties", () => {
		const secret = "c3ludGhldGljLXRlc3Qtbm90LWEtcmVhbC1vdXRwdXQta2V5";
		const command = `echo "${secret}" | base64 -d > "/etc/docklands/cert.key";`;
		const error = Object.assign(new Error(`Command failed: ${command}`), {
			cmd: command,
			stdout: `stdout private key leaked: ${secret}`,
			stderr: Buffer.from(`stderr secret leaked: ${secret}`),
		});

		const redacted = redactErrorSecrets(error);

		expect(redacted.message).not.toContain(secret);
		expect(redacted.cmd).not.toContain(secret);
		expect(redacted.stdout).not.toContain(secret);
		expect(redacted.stderr?.toString()).not.toContain(secret);
	});
});
