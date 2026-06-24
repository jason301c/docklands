// Docklands embeds some secrets directly into the shell commands it runs: the
// SSH key written to /tmp/id_rsa when cloning over SSH, and the base64 TLS key
// piped to `base64 -d` when provisioning certificates on a remote runtimeWorker. When
// such a command fails, its ExecError (command/stdout/stderr) is logged, which
// would otherwise persist the secret in plain text. These helpers strip that
// material before it can reach the logs.

const PRIVATE_KEY_BLOCK =
	/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

const BASE64_DECODE_PIPE = /echo "[A-Za-z0-9+/=]+"\s*\|\s*base64 -d/g;
const CONTEXTUAL_BASE64_SECRET =
	/((?:key|secret|token|password)[^\r\n]{0,80}?)[A-Za-z0-9+/]{32,}={0,2}/gi;

// Credentials embedded in a URL's userinfo, e.g. the git clone URL
// `https://oauth2:<token>@github.com/...`. Strip the whole `user[:pass]@` part
// so the token never reaches logs (the previous patterns don't cover it).
const URL_USERINFO_CREDENTIAL =
	/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+(?::[^/\s@]+)?@/gi;

// Database CLI password flags. The long form (`--password=x` / `--password x`,
// used by mysql/mariadb/mongo dump+restore) is unambiguous. The short form is
// matched ONLY when the value is adjacent (`-px` / `-p'x'`, as mysql/mariadb
// emit it) — never `-p <value>`, so it can't mangle `mkdir -p /path` or
// `docker -p 8080`. The lookbehind avoids the `-p` inside `--password`.
const PASSWORD_LONG_FLAG = /(--password[= ])('[^']*'|"[^"]*"|[^\s|]+)/g;
const PASSWORD_SHORT_FLAG = /((?<![-\w])-p)('[^']*'|"[^"]*"|[^\s|]+)/g;

export const redactSecrets = (value: string): string =>
	value
		.replace(PRIVATE_KEY_BLOCK, "[REDACTED PRIVATE KEY]")
		.replace(BASE64_DECODE_PIPE, 'echo "[REDACTED]" | base64 -d')
		.replace(URL_USERINFO_CREDENTIAL, "$1[REDACTED]@")
		.replace(PASSWORD_LONG_FLAG, "$1[REDACTED]")
		.replace(PASSWORD_SHORT_FLAG, "$1[REDACTED]")
		.replace(CONTEXTUAL_BASE64_SECRET, "$1[REDACTED]");

// Node's child_process errors repeat the failed command on `message`, `stack`
// and `cmd`, so redact those too when wrapping an original error.
export const redactErrorSecrets = <T extends Error>(error: T): T => {
	const candidate = error as T & {
		cmd?: string;
		stdout?: string | Buffer;
		stderr?: string | Buffer;
	};
	candidate.message = redactSecrets(candidate.message);
	if (candidate.stack) {
		candidate.stack = redactSecrets(candidate.stack);
	}
	if (candidate.cmd) {
		candidate.cmd = redactSecrets(candidate.cmd);
	}
	if (typeof candidate.stdout === "string") {
		candidate.stdout = redactSecrets(candidate.stdout);
	} else if (Buffer.isBuffer(candidate.stdout)) {
		candidate.stdout = Buffer.from(redactSecrets(candidate.stdout.toString()));
	}
	if (typeof candidate.stderr === "string") {
		candidate.stderr = redactSecrets(candidate.stderr);
	} else if (Buffer.isBuffer(candidate.stderr)) {
		candidate.stderr = Buffer.from(redactSecrets(candidate.stderr.toString()));
	}
	return candidate;
};
