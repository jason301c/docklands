import { randomBytes } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const secretPattern = /^(BETTER_AUTH_SECRET|BETTER_AUTH_SECRET_FILE)=.+$/m;

if (process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET_FILE) {
	console.log("[ensure-auth-secret] Better Auth secret is already configured");
	process.exit(0);
}

const currentEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (secretPattern.test(currentEnv)) {
	console.log("[ensure-auth-secret] Better Auth secret is already in .env");
	process.exit(0);
}

const secret = randomBytes(48).toString("base64url");
const prefix = currentEnv.length > 0 && !currentEnv.endsWith("\n") ? "\n" : "";
const entry = `${prefix}BETTER_AUTH_SECRET="${secret}"\n`;

if (existsSync(envPath)) {
	appendFileSync(envPath, entry);
} else {
	writeFileSync(envPath, entry);
}

console.log("[ensure-auth-secret] Generated BETTER_AUTH_SECRET in .env");
