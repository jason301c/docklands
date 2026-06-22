import net from "node:net";
import postgres from "postgres";
import { dbUrl } from "@/server/core/db/constants";
import {
	formatPostgresConnectionFailure,
	isFatalPostgresConfigError,
	type PostgresTarget,
	resolvePostgresTargetFromUrl,
} from "./postgres-wait";

const TIMEOUT_MS = Number(process.env.POSTGRES_WAIT_TIMEOUT || 120_000);
const RETRY_DELAY_MS = Number(process.env.POSTGRES_WAIT_RETRY || 2000);

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePostgresTarget(): PostgresTarget {
	const databaseUrl = dbUrl;

	if (!databaseUrl) {
		console.error("[wait-for-postgres] DATABASE_URL is not set");
		process.exit(1);
	}

	try {
		return resolvePostgresTargetFromUrl(databaseUrl);
	} catch (err) {
		console.error("[wait-for-postgres] Invalid DATABASE_URL:", databaseUrl);
		process.exit(1);
	}
}

function checkTcpConnection(host: string, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host, port });

		socket.setTimeout(3000);

		socket.on("connect", () => {
			socket.end();
			resolve();
		});

		socket.on("timeout", () => {
			socket.destroy();
			reject(new Error("Connection timeout"));
		});

		socket.on("error", reject);
	});
}

async function checkDatabaseConnection(databaseUrl: string): Promise<void> {
	const sql = postgres(databaseUrl, {
		max: 1,
		connect_timeout: 3,
	});

	try {
		await sql`select 1`;
	} finally {
		await sql.end({ timeout: 1 });
	}
}

async function waitForPostgres() {
	const target = resolvePostgresTarget();
	const start = Date.now();
	let lastDatabaseError: unknown;

	console.log(
		`[wait-for-postgres] Waiting for postgres at ${target.host}:${target.port} (timeout ${TIMEOUT_MS}ms)`,
	);

	while (true) {
		try {
			await checkTcpConnection(target.host, target.port);
			await checkDatabaseConnection(dbUrl);
			console.log(
				"[wait-for-postgres] Postgres is reachable and accepts DATABASE_URL ✅",
			);
			return;
		} catch (error) {
			lastDatabaseError = error;
			if (isFatalPostgresConfigError(error)) {
				console.error(formatPostgresConnectionFailure(error, target));
				process.exit(1);
			}

			const elapsed = Date.now() - start;

			if (elapsed > TIMEOUT_MS) {
				console.error(
					`[wait-for-postgres] Timeout after ${elapsed}ms. Postgres not reachable ❌`,
				);
				if (lastDatabaseError) {
					console.error(
						formatPostgresConnectionFailure(lastDatabaseError, target),
					);
				}
				process.exit(1);
			}

			console.log(
				`[wait-for-postgres] Postgres not ready yet, retrying in ${RETRY_DELAY_MS}ms...`,
			);
			await sleep(RETRY_DELAY_MS);
		}
	}
}

waitForPostgres().catch((err) => {
	console.error("[wait-for-postgres] Fatal error:", err);
	process.exit(1);
});
