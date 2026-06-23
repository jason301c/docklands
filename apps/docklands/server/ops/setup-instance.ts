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
		logger.info({ step: "postgres" }, "Initializing Postgres");
		await initializePostgres();
		// Plain stdout — operator-facing success banner.
		console.log("Docklands setup completed");
		exit(0);
	} catch (e) {
		logger.fatal({ err: e }, "Docklands setup failed");
		exit(1);
	}
})();
