import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readSecret } from "@/server/core/db/constants";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("crypto:secret-box");

/**
 * Application-level encryption-at-rest for secret material (the Docklands analog
 * of Coolify's Laravel `encrypted` cast). Wraps AES-256-GCM keyed by a dedicated
 * `DOCKLANDS_ENCRYPTION_KEY`, separate from `BETTER_AUTH_SECRET` so rotating the
 * auth-signing secret never forces a data re-encrypt.
 *
 * Output format is versioned so the scheme can evolve and a future rotation
 * migration can detect what it's looking at:
 *
 *     v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 *
 * `decryptSecret` treats any value that is NOT in this format as already
 * plaintext and returns it unchanged. That keeps the transparent column type
 * safe across the pre-release rollout (legacy/seed rows, dev data) without a
 * backfill bridge.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

// 32 zero-ish bytes, base64. Only used under NODE_ENV=test so the suite can
// round-trip secrets without provisioning a real key. Never used in prod.
const TEST_ENCRYPTION_KEY = Buffer.alloc(KEY_BYTES, 7).toString("base64");

let cachedKey: Buffer | null = null;

const decodeKey = (raw: string): Buffer => {
	const key = Buffer.from(raw.trim(), "base64");
	if (key.length !== KEY_BYTES) {
		throw new Error(
			`DOCKLANDS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes ` +
				`(got ${key.length}). Generate one with: ` +
				"openssl rand -base64 32",
		);
	}
	return key;
};

/**
 * Resolve the raw key material. Mirrors the Better Auth secret model:
 * `DOCKLANDS_ENCRYPTION_KEY` (base64) or `DOCKLANDS_ENCRYPTION_KEY_FILE`
 * (path, for Docker secrets), a test fallback, otherwise throw.
 */
export const resolveEncryptionKey = (
	env: NodeJS.ProcessEnv = process.env,
): string => {
	if (env.DOCKLANDS_ENCRYPTION_KEY) {
		logger.debug({ source: "env" }, "Encryption key resolved");
		return env.DOCKLANDS_ENCRYPTION_KEY;
	}
	if (env.DOCKLANDS_ENCRYPTION_KEY_FILE) {
		logger.debug(
			{ source: "file", path: env.DOCKLANDS_ENCRYPTION_KEY_FILE },
			"Encryption key resolved",
		);
		return readSecret(env.DOCKLANDS_ENCRYPTION_KEY_FILE);
	}
	if (env.NODE_ENV === "test") {
		logger.debug({ source: "test-fallback" }, "Encryption key resolved");
		return TEST_ENCRYPTION_KEY;
	}
	throw new Error(
		"DOCKLANDS_ENCRYPTION_KEY or DOCKLANDS_ENCRYPTION_KEY_FILE must be set " +
			"(a base64-encoded 32-byte key). `bun run setup` generates one for " +
			"local installs.",
	);
};

// Resolved lazily and cached so that importing the schema (e.g. for
// `migration:generate`, or tests that never touch encrypted values) does not
// require a key — only an actual encrypt/decrypt does.
const getKey = (): Buffer => {
	if (!cachedKey) {
		cachedKey = decodeKey(resolveEncryptionKey());
	}
	return cachedKey;
};

/** Test seam: drop the cached key so a test can swap env and re-resolve. */
export const resetEncryptionKeyCache = () => {
	cachedKey = null;
};

const isEncrypted = (value: string): boolean => value.startsWith(`${VERSION}:`);

export const encryptSecret = (plaintext: string): string => {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [
		VERSION,
		iv.toString("base64"),
		tag.toString("base64"),
		ciphertext.toString("base64"),
	].join(":");
};

export const decryptSecret = (stored: string): string => {
	// Anything not in our versioned envelope is treated as already-plaintext.
	// This keeps reads safe across the rollout and for externally-seeded rows.
	if (!isEncrypted(stored)) {
		return stored;
	}
	// ciphertext may legitimately be empty (empty plaintext), so validate by
	// segment count rather than truthiness.
	const parts = stored.split(":");
	if (parts.length !== 4) {
		throw new Error("Malformed encrypted value");
	}
	const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
	const decipher = createDecipheriv(
		ALGORITHM,
		getKey(),
		Buffer.from(ivB64, "base64"),
	);
	decipher.setAuthTag(Buffer.from(tagB64, "base64"));
	return Buffer.concat([
		decipher.update(Buffer.from(ctB64, "base64")),
		decipher.final(),
	]).toString("utf8");
};
