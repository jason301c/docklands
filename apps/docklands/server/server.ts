import http from "node:http";
import { config } from "dotenv";
import next from "next";
import { createLogger } from "@/server/core/lib/logger";
import {
	markReadinessComplete,
	markReadinessStarting,
	markReadinessStepFailed,
	markReadinessStepOk,
	markReadinessStepRunning,
} from "@/server/core/readiness";
import { reconcileInstanceUrlEnv } from "@/server/core/services/instance-url";
import { ensureTunnelRunning } from "@/server/core/services/tunnel";
import { setupDirectories } from "@/server/core/setup/config-paths";
import { initializeNetwork, initializeSwarm } from "@/server/core/setup/setup";
import {
	createDefaultMiddlewares,
	createDefaultServerTraefikConfig,
	createDefaultTraefikConfig,
} from "@/server/core/setup/traefik-setup";
import { initCronJobs } from "@/server/core/utils/backups/index";
import { initTunnelHealthCron } from "@/server/core/utils/cloudflare/tunnel-health";
import { sendDocklandsRestartNotifications } from "@/server/core/utils/notifications/docklands-restart";
import { initPreviewCleanupCron } from "@/server/core/utils/previews/index";
import { initCancelDeployments } from "@/server/core/utils/startup/cancel-deployments";
import { initVolumeBackupsCronJobs } from "@/server/core/utils/volume-backups/index";
import packageInfo from "../package.json";

const logger = createLogger("server");

// The whole control plane — UI, tRPC API, deployment queue, WebSocket servers,
// and cron jobs — runs in this single Node process. A stray throw from an async
// I/O callback (e.g. an ssh2 socket event) would otherwise become an
// uncaughtException and take down every deployment and session at once. Log and
// keep running so one bad callback can't kill everything; individual handlers
// still do their own graceful cleanup.
process.on("uncaughtException", (err) => {
	logger.error({ err }, "uncaughtException (process kept alive)");
});
process.on("unhandledRejection", (reason) => {
	logger.error({ err: reason }, "unhandledRejection (process kept alive)");
});

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
	markReadinessStarting();
	setupDirectories();
	createDefaultTraefikConfig();
	createDefaultServerTraefikConfig();
	logger.info("production init complete");
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

		logger.info({ version: packageInfo.version }, "server starting");
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

		// Reconcile the canonical instance URL into the Better Auth env channel
		// BEFORE the server accepts its first request, so Better Auth's lazily-built
		// config (Secure cookies, passkey rpId) and every absolute link the app
		// emits resolve to the same operator-configured origin. Best-effort: a
		// failure here must not block startup — auth falls back to the env or
		// request-derived origin.
		try {
			await reconcileInstanceUrlEnv();
		} catch (err) {
			logger.warn({ err }, "instance URL reconcile failed (continuing)");
		}

		runtimeWorker.listen(PORT, HOST);
		logger.info({ host: HOST, port: PORT }, "server listening");
		if (process.env.NODE_ENV === "production") {
			markReadinessStarting();
			// Each bootstrap step is independently guarded: a failure in one
			// (tunnels, cron, network, …) must not abort the rest — most importantly
			// it must not prevent the deployment worker (below) from starting.
			// Readiness records critical failures so liveness can stay green while
			// orchestrators and operators see deploy-critical bootstrap failures.
			const bootStep = async (
				step: string,
				fn: () => unknown,
				options: { critical?: boolean } = {},
			) => {
				markReadinessStepRunning(step, options);
				try {
					await fn();
					markReadinessStepOk(step);
				} catch (err) {
					markReadinessStepFailed(step, err, options);
					logger.error({ err, step }, "bootstrap step failed (continuing)");
				}
			};
			await bootStep("middlewares", () => createDefaultMiddlewares(), {
				critical: true,
			});
			await bootStep("swarm", () => initializeSwarm(), { critical: true });
			await bootStep("network", () => initializeNetwork(), { critical: true });
			// Restore any Cloudflare Tunnels (managed cloudflared) after the
			// overlay network exists. Best-effort per tunnel.
			await bootStep("tunnels", () => ensureTunnelRunning(), {
				critical: false,
			});
			await bootStep("tunnel-health", () => initTunnelHealthCron(), {
				critical: false,
			});
			await bootStep("cron", () => initCronJobs(), { critical: false });
			await bootStep("cancel-deployments", () => initCancelDeployments(), {
				critical: false,
			});
			await bootStep("volume-backups", () => initVolumeBackupsCronJobs(), {
				critical: false,
			});
			await bootStep("preview-cleanup", () => initPreviewCleanupCron(), {
				critical: false,
			});
			await bootStep(
				"restart-notifications",
				() => sendDocklandsRestartNotifications(),
				{ critical: false },
			);
		}
		logger.info("starting deployment worker");
		const { startDeploymentWorker } = await import("./queues/queueSetup");
		markReadinessStepRunning("deployment-worker", { critical: true });
		try {
			await startDeploymentWorker();
			markReadinessStepOk("deployment-worker");
		} catch (err) {
			markReadinessStepFailed("deployment-worker", err, { critical: true });
			throw err;
		}
		markReadinessComplete();
		logger.info("deployment worker started");
	} catch (e) {
		logger.error({ err: e }, "server bootstrap failed");
	}
});
