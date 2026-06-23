/**
 * Use this command after building Docklands: node -r dotenv/config dist/migrate-auth-secret.mjs
 * Migration script: re-encrypt 2FA secrets after rotating BETTER_AUTH_SECRET.
 *
 * Usage:
 *   OLD_SECRET=<old_secret> NEW_SECRET=<new_secret> npx tsx server/ops/migrate-auth-secret.ts
 *
 * Both OLD_SECRET and NEW_SECRET are required.
 * Run this BEFORE restarting Docklands with the new secret.
 */

import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { twoFactor } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ops:migrate-auth-secret");

const OLD_SECRET = process.env.OLD_SECRET as string;
const NEW_SECRET = process.env.NEW_SECRET as string;

if (!OLD_SECRET || !NEW_SECRET) {
	logger.fatal(
		"OLD_SECRET and NEW_SECRET environment variables are required. " +
			"Usage: OLD_SECRET=<old> NEW_SECRET=<new> npx tsx server/ops/migrate-auth-secret.ts",
	);
	process.exit(1);
}

if (OLD_SECRET === NEW_SECRET) {
	logger.fatal("OLD_SECRET and NEW_SECRET must be different");
	process.exit(1);
}

async function reEncrypt(
	value: string,
	oldSecret: string,
	newSecret: string,
): Promise<string> {
	const plaintext = await symmetricDecrypt({ key: oldSecret, data: value });
	return symmetricEncrypt({ key: newSecret, data: plaintext });
}

async function main() {
	logger.info("Fetching 2FA records");
	const records = await db.select().from(twoFactor);

	if (records.length === 0) {
		logger.info("No 2FA records found, nothing to migrate");
		process.exit(0);
	}

	logger.info({ total: records.length }, "Found 2FA records to migrate");

	let migrated = 0;

	await db.transaction(async (tx) => {
		for (const record of records) {
			try {
				const [newSecret, newBackupCodes] = await Promise.all([
					reEncrypt(record.secret, OLD_SECRET, NEW_SECRET),
					reEncrypt(record.backupCodes, OLD_SECRET, NEW_SECRET),
				]);

				await tx
					.update(twoFactor)
					.set({ secret: newSecret, backupCodes: newBackupCodes })
					.where(eq(twoFactor.id, record.id));

				migrated++;
			} catch (err) {
				logger.error(
					{ err, recordId: record.id, userId: record.userId },
					"Failed to migrate 2FA record — rolling back transaction",
				);
				throw err; // rollback the whole transaction
			}
		}
	});

	logger.info({ migrated, total: records.length }, "Migration complete");
	process.exit(0);
}

main().catch((err) => {
	logger.fatal({ err }, "Migration failed");
	process.exit(1);
});
