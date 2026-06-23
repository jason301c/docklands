import http from "node:http";
import { config } from "dotenv";
import next from "next";
import { setupDirectories } from "@/server/core/setup/config-paths";
import { initializeNetwork } from "@/server/core/setup/setup";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
} from "@/server/core/setup/traefik-setup";
import { initCronJobs } from "@/server/core/utils/backups/index";
import { sendDocklandsRestartNotifications } from "@/server/core/utils/notifications/docklands-restart";
import { initSchedules } from "@/server/core/utils/schedules/index";
import { initCancelDeployments } from "@/server/core/utils/startup/cancel-deployments";
import { initVolumeBackupsCronJobs } from "@/server/core/utils/volume-backups/index";
import packageInfo from "../package.json";
import { setupDockerContainerLogsWebSocketServer } from "./wss/docker-container-logs";
import { setupDockerContainerTerminalWebSocketServer } from "./wss/docker-container-terminal";
import { setupDockerStatsMonitoringSocketServer } from "./wss/docker-stats";
import { setupDrawerLogsWebSocketServer } from "./wss/drawer-logs";
import { setupDeploymentLogsWebSocketServer } from "./wss/listen-deployment";
import { setupTerminalWebSocketServer } from "./wss/terminal";

config({ path: ".env" });
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

// Initialize critical directories and Traefik config BEFORE Next.js starts
// This prevents race conditions with the install script
if (process.env.NODE_ENV === "production") {
	setupDirectories();
	createDefaultTraefikConfig();
	createDefaultServerTraefikConfig();
	console.log("✅ initialization complete");
}

const app = next({
	dev,
	hostname: HOST,
	port: PORT,
	turbopack: true,
});
void app.prepare().then(async () => {
	try {
		const handle = app.getRequestHandler();
		const handleUpgrade = app.getUpgradeHandler();

		console.log("Running DocklandsVersion: ", packageInfo.version);
		const runtimeWorker = http.createServer((req, res) => {
			handle(req, res);
		});

		runtimeWorker.on("upgrade", (req, socket, head) => {
			const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

			if (pathname.startsWith("/_next/")) {
				void handleUpgrade(req, socket, head);
			}
		});

		// WEBSOCKET
		setupDrawerLogsWebSocketServer(runtimeWorker);
		setupDeploymentLogsWebSocketServer(runtimeWorker);
		setupDockerContainerLogsWebSocketServer(runtimeWorker);
		setupDockerContainerTerminalWebSocketServer(runtimeWorker);
		setupTerminalWebSocketServer(runtimeWorker);
		setupDockerStatsMonitoringSocketServer(runtimeWorker);

		runtimeWorker.listen(PORT, HOST);
		console.log(`Server Started on: http://${HOST}:${PORT}`);
		if (process.env.NODE_ENV === "production") {
			createDefaultMiddlewares();
			await initializeNetwork();
			await initCronJobs();
			await initSchedules();
			await initCancelDeployments();
			await initVolumeBackupsCronJobs();
			await sendDocklandsRestartNotifications();
		}
		console.log("Starting Deployment Worker");
		const { startDeploymentWorker } = await import("./queues/queueSetup");
		await startDeploymentWorker();
	} catch (e) {
		console.error("Main Server Error", e);
	}
});
