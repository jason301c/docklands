import { exec } from "node:child_process";
import { exit } from "node:process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

import { setupDirectories } from "@/server/core/setup/config-paths";
import { initializePostgres } from "@/server/core/setup/postgres-setup";
import { initializeRedis } from "@/server/core/setup/redis-setup";
import { initializeNetwork, initializeSwarm } from "@/server/core/setup/setup";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
	initializeStandaloneTraefik,
	TRAEFIK_VERSION,
} from "@/server/core/setup/traefik-setup";

(async () => {
	try {
		setupDirectories();
		createDefaultMiddlewares();
		await initializeSwarm();
		await initializeNetwork();
		createDefaultTraefikConfig();
		createDefaultServerTraefikConfig();
		await execAsync(`docker pull traefik:v${TRAEFIK_VERSION}`);
		await initializeStandaloneTraefik();
		await initializeRedis();
		await initializePostgres();
		console.log("Docklands setup completed");
		exit(0);
	} catch (e) {
		console.error("Error in dokploy setup", e);
	}
})();
