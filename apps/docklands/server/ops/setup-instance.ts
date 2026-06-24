import { exec } from "node:child_process";
import { exit } from "node:process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

import { createLogger } from "@/server/core/lib/logger";
import { setupDirectories } from "@/server/core/setup/config-paths";
import { initializePostgres } from "@/server/core/setup/postgres-setup";
import { initializeNetwork, initializeSwarm } from "@/server/core/setup/setup";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	initializeStandaloneTraefik,
	TRAEFIK_VERSION,
} from "@/server/core/setup/traefik-setup";

const logger = createLogger("ops:setup-instance");

/**
 * Whether to provision the bundled `docklands-postgres` container. We skip it
 * when the operator brings their own database — either explicitly via
 * `SKIP_BUNDLED_POSTGRES=true`, or when `DATABASE_URL` points at a clearly
 * remote host (not localhost/loopback/the bundled service name). The bundled DB
 * ships with a fixed password, so production installs on an external managed DB
 * should not run it. We default to provisioning on any ambiguity (unparseable
 * URL, loopback host) so we never leave a bundled setup without a database.
 */
const shouldProvisionBundledPostgres = (): boolean => {
	if (process.env.SKIP_BUNDLED_POSTGRES === "true") {
		return false;
	}
	const url = process.env.DATABASE_URL;
	if (!url) {
		return true;
	}
	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		return true;
	}
	const bundledHosts = new Set([
		"localhost",
		"127.0.0.1",
		"::1",
		"docklands-postgres",
		"",
	]);
	return bundledHosts.has(host);
};

(async () => {
	try {
		logger.info("Starting Docklands setup");
		setupDirectories();
		createDefaultMiddlewares();
		logger.info({ step: "swarm" }, "Initializing Docker Swarm");
		await initializeSwarm();
		logger.info({ step: "network" }, "Initializing Docker network");
		await initializeNetwork();
		createDefaultTraefikConfig();
		createDefaultServerTraefikConfig();
		logger.info(
			{ step: "traefik-pull", version: TRAEFIK_VERSION },
			"Pulling Traefik image",
		);
		await execAsync(`docker pull traefik:v${TRAEFIK_VERSION}`);
		logger.info({ step: "traefik-start" }, "Starting standalone Traefik");
		await initializeStandaloneTraefik();
		if (shouldProvisionBundledPostgres()) {
			logger.info({ step: "postgres" }, "Initializing Postgres");
			await initializePostgres();
		} else {
			logger.info(
				{ step: "postgres" },
				"Skipping bundled Postgres — using the configured external DATABASE_URL",
			);
		}
		// Plain stdout — operator-facing success banner.
		console.log("Docklands setup completed");
		exit(0);
	} catch (e) {
		logger.fatal({ err: e }, "Docklands setup failed");
		exit(1);
	}
})();
