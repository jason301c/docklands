import type http from "node:http";
import { WebSocketServer } from "ws";
import { docker } from "@/server/core/constants/docker";
import { validateRequest } from "@/server/core/lib/auth";
import { createLogger } from "@/server/core/lib/logger";
import {
	getHostSystemStats,
	getLastAdvancedStatsFile,
	recordAdvancedStats,
} from "@/server/core/monitoring/utils";
import { execAsync } from "@/server/core/utils/process/execAsync";
import { canAccessDockerWs } from "./utils";

const logger = createLogger("wss-stats");

export const setupDockerStatsMonitoringSocketServer = (
	runtimeWorker: http.Server<
		typeof http.IncomingMessage,
		typeof http.ServerResponse
	>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/listen-docker-stats-monitoring",
	});

	runtimeWorker.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/listen-docker-stats-monitoring") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);

		const appName = url.searchParams.get("appName");
		const appType = (url.searchParams.get("appType") || "application") as
			| "application"
			| "stack"
			| "docker-compose";
		const { user, session } = await validateRequest(req);

		if (!appName) {
			ws.close(4000, "appName no provided");
			return;
		}

		if (!user || !session) {
			ws.close();
			return;
		}

		if (!(await canAccessDockerWs(user, session))) {
			ws.close();
			return;
		}
		const intervalId = setInterval(async () => {
			try {
				// Special case: when monitoring "docklands", get host system stats instead of container stats
				if (appName === "docklands") {
					const stat = await getHostSystemStats();

					await recordAdvancedStats(stat, appName);
					const data = await getLastAdvancedStatsFile(appName);

					ws.send(
						JSON.stringify({
							data,
						}),
					);
					return;
				}

				const filter = {
					status: ["running"],
					...(appType === "application" && {
						label: [`com.docker.swarm.service.name=${appName}`],
					}),
					...(appType === "stack" && {
						label: [`com.docker.swarm.task.name=${appName}`],
					}),
					...(appType === "docker-compose" && {
						name: [appName],
					}),
				};

				const containers = await docker.listContainers({
					filters: JSON.stringify(filter),
				});

				const container = containers[0];
				if (container?.State !== "running") {
					ws.close(4000, "Container not running");
					return;
				}
				const { stdout, stderr } = await execAsync(
					`docker stats ${container.Id} --no-stream --format '{"BlockIO":"{{.BlockIO}}","CPUPerc":"{{.CPUPerc}}","Container":"{{.Container}}","ID":"{{.ID}}","MemPerc":"{{.MemPerc}}","MemUsage":"{{.MemUsage}}","Name":"{{.Name}}","NetIO":"{{.NetIO}}"}'`,
				);
				if (stderr) {
					logger.warn(
						{ appName, stderr: stderr.slice(0, 500) },
						"docker stats stderr",
					);
					return;
				}
				const stat = JSON.parse(stdout);

				await recordAdvancedStats(stat, appName);
				const data = await getLastAdvancedStatsFile(appName);

				ws.send(
					JSON.stringify({
						data,
					}),
				);
			} catch (error) {
				logger.error({ err: error, appName }, "docker stats polling error");
				ws.close(
					4000,
					`Error: ${error instanceof Error ? error.message : "stats error"}`,
				);
			}
		}, 1300);

		ws.on("close", () => {
			clearInterval(intervalId);
		});
	});
};
