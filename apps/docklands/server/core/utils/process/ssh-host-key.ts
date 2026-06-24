import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { runtimeWorkers } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";

const logger = createLogger("ssh-host-key");

export interface HostKeyWorker {
	runtimeWorkerId: string;
	hostKey: string | null;
}

const safeEqual = (a: string, b: string): boolean => {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
};

/**
 * Persist a pinned SSH host key (best-effort). Exposed for the verifier and for
 * tests; failures are logged, not thrown, so a transient DB hiccup never blocks
 * a connection mid-handshake.
 */
export const pinHostKey = async (
	runtimeWorkerId: string,
	hostKey: string,
): Promise<void> => {
	try {
		await db
			.update(runtimeWorkers)
			.set({ hostKey })
			.where(eq(runtimeWorkers.runtimeWorkerId, runtimeWorkerId));
		logger.info(
			{ runtimeWorkerId },
			"Pinned SSH host key (trust-on-first-use)",
		);
	} catch (err) {
		logger.warn(
			{ err, runtimeWorkerId },
			"Failed to persist pinned SSH host key",
		);
	}
};

/**
 * Build an ssh2 `hostVerifier` for a runtime worker. Trust-on-first-use: the
 * first connection pins the server's host key; every later connection must
 * present the same key or the connection is refused — defeating a
 * man-in-the-middle that swaps the host key. Returns a verifier suitable for
 * both raw `ssh2` connects and dockerode's `sshOptions`.
 */
export const createHostVerifier =
	(worker: HostKeyWorker) =>
	(keyBuffer: Buffer, callback: (valid: boolean) => void): void => {
		const presented = keyBuffer.toString("base64");
		if (!worker.hostKey) {
			void pinHostKey(worker.runtimeWorkerId, presented);
			callback(true);
			return;
		}
		const ok = safeEqual(worker.hostKey, presented);
		if (!ok) {
			logger.error(
				{ runtimeWorkerId: worker.runtimeWorkerId },
				"SSH host key mismatch — refusing connection (possible man-in-the-middle)",
			);
		}
		callback(ok);
	};
