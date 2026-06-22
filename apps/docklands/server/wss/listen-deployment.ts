import { spawn } from "node:child_process";
import type http from "node:http";
import { Client } from "ssh2";
import { WebSocketServer } from "ws";
import { IS_CLOUD } from "@/server/core/constants/env";
import { validateRequest } from "@/server/core/lib/auth";
import { readValidDirectory } from "@/server/core/runtime/host";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { encodeBase64 } from "@/server/core/utils/docker/utils";
import { getRuntimeWorkerIdParam } from "./utils";

export const setupDeploymentLogsWebSocketServer = (
	runtimeWorker: http.Server<
		typeof http.IncomingMessage,
		typeof http.ServerResponse
	>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/listen-deployment",
	});

	runtimeWorker.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/listen-deployment") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const logPath = url.searchParams.get("logPath");
		const runtimeWorkerId = getRuntimeWorkerIdParam(url);
		const { user, session } = await validateRequest(req);

		// Generate unique connection ID for tracking
		const connectionId = `deployment-logs-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		if (!logPath) {
			console.log(`[${connectionId}] logPath no provided`);
			ws.close(4000, "logPath no provided");
			return;
		}

		if (!readValidDirectory(logPath, runtimeWorkerId)) {
			ws.close(4000, "Invalid log path");
			return;
		}

		if (!user || !session) {
			ws.close();
			return;
		}

		let tailProcess: ReturnType<typeof spawn> | null = null;
		let sshClient: Client | null = null;

		try {
			if (runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

				if (runtimeWorker.organizationId !== session.activeOrganizationId) {
					ws.close();
					return;
				}

				if (!runtimeWorker.sshKeyId) {
					ws.close();
					return;
				}

				sshClient = new Client();
				sshClient
					.on("ready", () => {
						const encodedPath = encodeBase64(logPath);
						const command = `tail -n +1 -f "$(echo '${encodedPath}' | base64 -d)"`;

						sshClient!.exec(command, (err, stream) => {
							if (err) {
								sshClient!.end();
								ws.close();
								return;
							}
							stream
								.on("close", () => {
									sshClient!.end();
									ws.close();
								})
								.on("data", (data: string) => {
									if (ws.readyState === ws.OPEN) {
										ws.send(data.toString());
									}
								})
								.stderr.on("data", (data) => {
									if (ws.readyState === ws.OPEN) {
										ws.send(data.toString());
									}
								});
						});
					})
					.on("error", (err) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(`SSH error: ${err.message}`);
							ws.close();
						}
						if (sshClient) {
							sshClient.end();
						}
					})
					.connect({
						host: runtimeWorker.ipAddress,
						port: runtimeWorker.port,
						username: runtimeWorker.username,
						privateKey: runtimeWorker.sshKey?.privateKey,
					});

				ws.on("close", () => {
					if (sshClient) {
						sshClient.end();
					}
				});
			} else {
				if (IS_CLOUD) {
					ws.send("This feature is not available in the cloud version.");
					ws.close();
					return;
				}
				tailProcess = spawn("tail", ["-n", "+1", "-f", logPath]);

				const stdout = tailProcess.stdout;
				const stderr = tailProcess.stderr;

				if (stdout) {
					stdout.on("data", (data) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(data.toString());
						}
					});
				}

				if (stderr) {
					stderr.on("data", (data) => {
						if (ws.readyState === ws.OPEN) {
							ws.send(new Error(`tail error: ${data.toString()}`).message);
						}
					});
				}

				tailProcess.on("close", () => {
					ws.close();
				});

				tailProcess.on("error", () => {
					if (ws.readyState === ws.OPEN) {
						ws.close();
					}
				});

				ws.on("close", () => {
					if (tailProcess && !tailProcess.killed) {
						tailProcess.kill("SIGTERM");
						// Force kill after a timeout if it doesn't terminate
						setTimeout(() => {
							if (tailProcess && !tailProcess.killed) {
								tailProcess.kill("SIGKILL");
							} else {
							}
						}, 1000);
					} else {
					}
				});
			}
		} catch (error) {
			// Clean up resources on error
			if (tailProcess && !tailProcess.killed) {
				tailProcess.kill("SIGTERM");
				setTimeout(() => {
					if (tailProcess && !tailProcess.killed) {
						tailProcess.kill("SIGKILL");
					}
				}, 1000);
			}
			if (sshClient) {
				sshClient.end();
			}
			if (ws.readyState === ws.OPEN) {
				// @ts-expect-error
				const errorMessage = error?.message as unknown as string;
				ws.send(errorMessage || "An error occurred");
				ws.close();
			}
		}
	});
};
