import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	decodeEncryptionKey,
	decryptSecret,
	decryptSecretWithKey,
	encryptSecret,
	encryptSecretWithKey,
	resolveEncryptionKey,
} from "@/server/core/crypto/secret-box";
import { encryptedJson, encryptedText } from "@/server/core/db/encrypted";

describe("key rotation (encrypt/decrypt with explicit keys)", () => {
	const keyA = randomBytes(32);
	const keyB = randomBytes(32);

	it("round-trips under an explicit key", () => {
		const enc = encryptSecretWithKey("rotate-me", keyA);
		expect(decryptSecretWithKey(enc, keyA)).toBe("rotate-me");
	});

	it("fails to decrypt with the wrong key", () => {
		const enc = encryptSecretWithKey("rotate-me", keyA);
		expect(() => decryptSecretWithKey(enc, keyB)).toThrow();
	});

	it("re-encrypts old→new and the value decrypts only under the new key", () => {
		const original = JSON.stringify({ databasePassword: "p@ss", n: 1 });
		const underA = encryptSecretWithKey(original, keyA);
		// Rotation: decrypt with old, re-encrypt with new.
		const underB = encryptSecretWithKey(
			decryptSecretWithKey(underA, keyA),
			keyB,
		);
		expect(decryptSecretWithKey(underB, keyB)).toBe(original);
		expect(() => decryptSecretWithKey(underB, keyA)).toThrow();
	});

	it("decodeEncryptionKey rejects a wrong-length key", () => {
		expect(() =>
			decodeEncryptionKey(randomBytes(16).toString("base64")),
		).toThrow();
		expect(() =>
			decodeEncryptionKey(randomBytes(32).toString("base64")),
		).not.toThrow();
	});
});

describe("secret-box", () => {
	it("round-trips a value", () => {
		const secret = "super-secret-token-123";
		expect(decryptSecret(encryptSecret(secret))).toBe(secret);
	});

	it("produces a versioned envelope", () => {
		expect(encryptSecret("x")).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
	});

	it("uses a fresh IV each time (ciphertexts differ)", () => {
		expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
	});

	it("round-trips empty strings and unicode", () => {
		expect(decryptSecret(encryptSecret(""))).toBe("");
		const u = "🔐 ключ — clé — 鍵";
		expect(decryptSecret(encryptSecret(u))).toBe(u);
	});

	it("treats non-versioned values as already-plaintext (rollout passthrough)", () => {
		expect(decryptSecret("legacy-plaintext")).toBe("legacy-plaintext");
		expect(decryptSecret("")).toBe("");
	});

	it("rejects a tampered ciphertext (GCM auth tag)", () => {
		const enc = encryptSecret("authentic");
		const parts = enc.split(":");
		// flip a byte in the ciphertext segment
		const ct = Buffer.from(parts[3] as string, "base64");
		ct[0] = ct[0]! ^ 0xff;
		const tampered = [parts[0], parts[1], parts[2], ct.toString("base64")].join(
			":",
		);
		expect(() => decryptSecret(tampered)).toThrow();
	});

	describe("resolveEncryptionKey", () => {
		it("prefers DOCKLANDS_ENCRYPTION_KEY", () => {
			expect(
				resolveEncryptionKey({ DOCKLANDS_ENCRYPTION_KEY: "abc" } as never),
			).toBe("abc");
		});
		it("falls back to the test key under NODE_ENV=test", () => {
			expect(resolveEncryptionKey({ NODE_ENV: "test" } as never)).toBeTruthy();
		});
		it("throws in production when unset", () => {
			expect(() =>
				resolveEncryptionKey({ NODE_ENV: "production" } as never),
			).toThrow(/DOCKLANDS_ENCRYPTION_KEY/);
		});
	});
});

describe("encrypted column types", () => {
	it("constructs column builders without resolving the key eagerly", () => {
		expect(() => encryptedText("secret")).not.toThrow();
		expect(() =>
			encryptedJson<{ databasePassword: string }>("cfg"),
		).not.toThrow();
	});

	it("honors the encryptedJson contract (encrypt(JSON) / parse(decrypt))", () => {
		// Use a distinctive hyphenated marker: hyphens never appear in the standard
		// base64 envelope, so this can't false-fail the way a 2-char substring
		// ("pw") could when it coincidentally shows up in random base64.
		const value = { databasePassword: "super-secret-db-password", n: 5 };
		const stored = encryptSecret(JSON.stringify(value));
		expect(stored).not.toContain("super-secret-db-password");
		expect(JSON.parse(decryptSecret(stored))).toEqual(value);
	});
});
