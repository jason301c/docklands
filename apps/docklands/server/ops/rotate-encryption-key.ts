import postgres from "postgres";
import {
	decodeEncryptionKey,
	decryptSecretWithKey,
	encryptSecretWithKey,
	isEncrypted,
	resolveEncryptionKey,
} from "@/server/core/crypto/secret-box";
import { dbUrl } from "@/server/core/db";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ops:rotate-encryption-key");

/**
 * Re-encrypt every value stored with the versioned secret-box envelope from the
 * current DOCKLANDS_ENCRYPTION_KEY to a new one (DOCKLANDS_NEW_ENCRYPTION_KEY).
 *
 * Rather than maintain a list of encrypted columns (easy to let drift), it scans
 * every text/varchar column in the public schema for values that start with the
 * `v1:` envelope — encryptedText AND encryptedJson both store that envelope in a
 * text column, so this is complete. Each row is rewritten under the new key in a
 * single transaction; a failure rolls the whole thing back, so the data is never
 * left half-rotated. The old key is needed to decrypt and is never logged.
 *
 * After it succeeds, set DOCKLANDS_ENCRYPTION_KEY to the new key and restart.
 */
const main = async () => {
	const newRaw = process.env.DOCKLANDS_NEW_ENCRYPTION_KEY;
	if (!newRaw) {
		console.error(
			"DOCKLANDS_NEW_ENCRYPTION_KEY is required (base64, 32 bytes). " +
				"Generate one with: openssl rand -base64 32",
		);
		process.exit(1);
	}

	let oldKey: Buffer;
	let newKey: Buffer;
	try {
		oldKey = decodeEncryptionKey(resolveEncryptionKey());
		newKey = decodeEncryptionKey(newRaw);
	} catch (err) {
		logger.fatal({ err }, "Invalid encryption key");
		process.exit(1);
	}
	if (oldKey.equals(newKey)) {
		console.error("DOCKLANDS_NEW_ENCRYPTION_KEY equals the current key.");
		process.exit(1);
	}

	const sql = postgres(dbUrl, { max: 1 });
	let rotated = 0;
	try {
		const columns = await sql<{ table_name: string; column_name: string }[]>`
			SELECT table_name, column_name
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND data_type IN ('text', 'character varying')
		`;

		await sql.begin(async (tx) => {
			for (const { table_name, column_name } of columns) {
				const rows = await tx`
					SELECT ${tx(column_name)} AS value
					FROM ${tx(table_name)}
					WHERE ${tx(column_name)} LIKE 'v1:%'
				`;
				for (const row of rows) {
					const value = row.value as string;
					if (!isEncrypted(value)) continue;
					const reencrypted = encryptSecretWithKey(
						decryptSecretWithKey(value, oldKey),
						newKey,
					);
					// Each envelope carries a random IV, so a ciphertext is unique —
					// matching on the old value targets exactly its row(s) without
					// needing each table's primary key.
					await tx`
						UPDATE ${tx(table_name)}
						SET ${tx(column_name)} = ${reencrypted}
						WHERE ${tx(column_name)} = ${value}
					`;
					rotated++;
				}
			}
		});

		logger.info({ rotated }, "Encryption key rotation complete");
		console.log(
			`\n✅ Re-encrypted ${rotated} value(s) under the new key.\n` +
				"Next: set DOCKLANDS_ENCRYPTION_KEY to the new key and restart Docklands.\n" +
				"Keep the old key until you've confirmed everything still decrypts.\n",
		);
	} catch (err) {
		logger.fatal({ err }, "Encryption key rotation failed — rolled back");
		process.exitCode = 1;
	} finally {
		await sql.end({ timeout: 5 });
	}
};

main();
