import { describe, expect, it, vi } from "vitest";
import { createHostVerifier } from "@/server/core/utils/process/ssh-host-key";

// The verifier captures the runtime worker's pinned host key and returns an
// ssh2 hostVerifier. Trust-on-first-use: first connection pins + accepts; later
// connections must present the same key or are refused.
describe("SSH host-key verifier (trust-on-first-use)", () => {
	it("accepts and pins on the first connection (no stored key)", () => {
		const verifier = createHostVerifier({
			runtimeWorkerId: "w1",
			hostKey: null,
		});
		const cb = vi.fn();
		verifier(Buffer.from("server-host-key-A"), cb);
		expect(cb).toHaveBeenCalledWith(true);
	});

	it("accepts when the presented key matches the pinned key", () => {
		const key = Buffer.from("server-host-key-A");
		const verifier = createHostVerifier({
			runtimeWorkerId: "w1",
			hostKey: key.toString("base64"),
		});
		const cb = vi.fn();
		verifier(key, cb);
		expect(cb).toHaveBeenCalledWith(true);
	});

	it("refuses when the presented key differs from the pinned key", () => {
		const verifier = createHostVerifier({
			runtimeWorkerId: "w1",
			hostKey: Buffer.from("server-host-key-A").toString("base64"),
		});
		const cb = vi.fn();
		verifier(Buffer.from("attacker-substituted-key"), cb);
		expect(cb).toHaveBeenCalledWith(false);
	});

	it("refuses a same-length but different key (no prefix/truncation bypass)", () => {
		const pinned = Buffer.from("AAAABBBB");
		const verifier = createHostVerifier({
			runtimeWorkerId: "w1",
			hostKey: pinned.toString("base64"),
		});
		const cb = vi.fn();
		verifier(Buffer.from("AAAACCCC"), cb);
		expect(cb).toHaveBeenCalledWith(false);
	});
});
