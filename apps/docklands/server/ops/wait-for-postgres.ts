import net from "node:net";
import postgres from "postgres";
import { dbUrl } from "@/server/core/db/constants";
import { createLogger } from "@/server/core/lib/logger";
import {
	formatPostgresConnectionFailure,
	isFatalPostgresConfigError,
	type PostgresTarget,
	resolvePostgresTargetFromUrl,
} from "./postgres-wait";

const logger = createLogger("ops:wait-for-postgres");

const TIMEOUT_MS = Number(process.env.POSTGRES_WAIT_TIMEOUT || 120_000);
const RETRY_DELAY_MS = Number(process.env.POSTGRES_WAIT_RETRY || 2000);

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePostgresTarget(): PostgresTarget {
	const databaseUrl = dbUrl;

	if (!databaseUrl) {
		logger.fatal("DATABASE_URL is not set");
		process.exit(1);
	}

	try {
		return resolvePostgresTargetFromUrl(databaseUrl);
	} catch (err) {
		// Parse a safe subset from the URL before logging — never log the full URL
		// because it contains credentials. Best-effort: if URL parsing itself fails
		// we can only log that the URL is malformed.
		let safeInfo: { host?: string; port?: string; database?: string } = {};
		try {
			const parsed = new URL(databaseUrl);
			safeInfo = {
				host: parsed.hostname,
				port: parsed.port || "5432",
				database: parsed.pathname.replace(/^\//, "") || undefined,
			};
		} catch {
			// URL could not be parsed at all — log no fields
		}
		logger.fatal({ err, ...safeInfo }, "Invalid DATABASE_URL");
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

	logger.info(
		{ host: target.host, port: target.port, timeoutMs: TIMEOUT_MS },
		"Waiting for Postgres",
	);

	while (true) {
		try {
			await checkTcpConnection(target.host, target.port);
			await checkDatabaseConnection(dbUrl);
			logger.info(
				{ host: target.host, port: target.port },
				"Postgres is reachable and accepts DATABASE_URL",
			);
			return;
		} catch (error) {
			lastDatabaseError = error;
			if (isFatalPostgresConfigError(error)) {
				logger.fatal(
					{ err: error, host: target.host, port: target.port },
					formatPostgresConnectionFailure(error, target),
				);
				process.exit(1);
			}

			const elapsed = Date.now() - start;

			if (elapsed > TIMEOUT_MS) {
				logger.fatal(
					{
						err: lastDatabaseError,
						host: target.host,
						port: target.port,
						elapsedMs: elapsed,
					},
					"Timeout reached — Postgres not reachable",
				);
				process.exit(1);
			}

			logger.debug(
				{ retryDelayMs: RETRY_DELAY_MS },
				"Postgres not ready yet, retrying",
			);
			await sleep(RETRY_DELAY_MS);
		}
	}
}

waitForPostgres().catch((err) => {
	logger.fatal({ err }, "Fatal error waiting for Postgres");
	process.exit(1);
});
