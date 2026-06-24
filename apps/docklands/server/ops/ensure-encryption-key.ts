import { randomBytes } from "node:crypto";
import {
	appendFileSync,
	chmodSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ops:ensure-encryption-key");

const envPath = resolve(process.cwd(), ".env");
const keyPattern =
	/^(DOCKLANDS_ENCRYPTION_KEY|DOCKLANDS_ENCRYPTION_KEY_FILE)=.+$/m;

if (
	process.env.DOCKLANDS_ENCRYPTION_KEY ||
	process.env.DOCKLANDS_ENCRYPTION_KEY_FILE
) {
	logger.info("Encryption key is already configured");
	process.exit(0);
}

const currentEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (keyPattern.test(currentEnv)) {
	logger.info("Encryption key is already in .env");
	process.exit(0);
}

// 32 bytes, base64 — what `secret-box.ts` expects (AES-256).
const key = randomBytes(32).toString("base64");
const prefix = currentEnv.length > 0 && !currentEnv.endsWith("\n") ? "\n" : "";
const entry = `${prefix}DOCKLANDS_ENCRYPTION_KEY="${key}"\n`;

if (existsSync(envPath)) {
	appendFileSync(envPath, entry);
} else {
	writeFileSync(envPath, entry, { mode: 0o600 });
}

// The encryption key protects every secret stored at rest, so the .env that
// holds it must not be world-readable. Tighten perms whether we created or
// appended to it.
chmodSync(envPath, 0o600);

logger.info("Generated DOCKLANDS_ENCRYPTION_KEY in .env");
