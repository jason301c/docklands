import { customType } from "drizzle-orm/pg-core";
import { decryptSecret, encryptSecret } from "@/server/core/crypto/secret-box";

/**
 * Transparent column encryption for secret material — the Drizzle analog of
 * Laravel's one-word `encrypted` cast. Call sites read/write plain values; the
 * value is encrypted on the way to the driver and decrypted on the way back, so
 * a DB dump or `/etc/docklands` snapshot never exposes the secret in the clear.
 *
 * The SQL type stays `text`, so switching a plain `text("col")` to
 * `encryptedText("col")` produces no migration diff — only the application
 * behavior changes. (See `secret-box.ts` for the key + envelope format.)
 */
export const encryptedText = (name: string) =>
	customType<{ data: string; driverData: string }>({
		dataType: () => "text",
		toDriver: (value) => encryptSecret(value),
		fromDriver: (value) => decryptSecret(value),
	})(name);

/**
 * Encrypted JSON: encrypts `JSON.stringify(value)` and parses on read, stored as
 * `text`. Use for credential blobs that were previously `json`/`jsonb`
 * (e.g. `database.config`). Because the stored type becomes `text`, switching a
 * `json("col")` to `encryptedJson("col")` DOES require a migration, and any raw
 * jsonb operators on the column must be removed first (Docklands has none).
 */
export const encryptedJson = <T>(name: string) =>
	customType<{ data: T; driverData: string }>({
		dataType: () => "text",
		toDriver: (value) => encryptSecret(JSON.stringify(value)),
		fromDriver: (value) => JSON.parse(decryptSecret(value)) as T,
	})(name);
