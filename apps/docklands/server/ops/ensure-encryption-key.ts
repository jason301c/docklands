import { randomBytes } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const keyPattern =
	/^(DOCKLANDS_ENCRYPTION_KEY|DOCKLANDS_ENCRYPTION_KEY_FILE)=.+$/m;

if (
	process.env.DOCKLANDS_ENCRYPTION_KEY ||
	process.env.DOCKLANDS_ENCRYPTION_KEY_FILE
) {
	console.log("[ensure-encryption-key] Encryption key is already configured");
	process.exit(0);
}

const currentEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (keyPattern.test(currentEnv)) {
	console.log("[ensure-encryption-key] Encryption key is already in .env");
	process.exit(0);
}

// 32 bytes, base64 — what `secret-box.ts` expects (AES-256).
const key = randomBytes(32).toString("base64");
const prefix = currentEnv.length > 0 && !currentEnv.endsWith("\n") ? "\n" : "";
const entry = `${prefix}DOCKLANDS_ENCRYPTION_KEY="${key}"\n`;

if (existsSync(envPath)) {
	appendFileSync(envPath, entry);
} else {
	writeFileSync(envPath, entry);
}

console.log(
	"[ensure-encryption-key] Generated DOCKLANDS_ENCRYPTION_KEY in .env",
);
