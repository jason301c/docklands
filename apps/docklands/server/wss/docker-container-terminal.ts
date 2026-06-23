import type http from "node:http";
import { spawn } from "node-pty";
import { Client } from "ssh2";
import { WebSocketServer } from "ws";
import { validateRequest } from "@/server/core/lib/auth";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import {
	canAccessDockerWs,
	getRuntimeWorkerIdParam,
	isValidContainerId,
	isValidShell,
} from "./utils";

export const setupDockerContainerTerminalWebSocketServer = (
	runtimeWorker: http.Server<
		typeof http.IncomingMessage,
		typeof http.ServerResponse
	>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/docker-container-terminal",
	});

	runtimeWorker.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

		if (pathname === "/docker-container-terminal") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const containerId = url.searchParams.get("containerId");
		const activeWay = url.searchParams.get("activeWay");
		const runtimeWorkerId = getRuntimeWorkerIdParam(url);
		const { user, session } = await validateRequest(req);

		if (!containerId) {
			ws.close(4000, "containerId not provided");
			return;
		}

		// Security: Validate containerId to prevent command injection
		if (!isValidContainerId(containerId)) {
			ws.close(4000, "Invalid container ID format");
			return;
		}

		// Security: Validate shell to prevent command injection
		if (activeWay && !isValidShell(activeWay)) {
			ws.close(4000, "Invalid shell specified");
			return;
		}

		// Default to 'sh' if no shell specified
		const shell = activeWay || "sh";

		if (!user || !session) {
			ws.close();
			return;
		}

		if (!(await canAccessDockerWs(user, session))) {
			ws.close();
			return;
		}
		try {
			if (runtimeWorkerId) {
				const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

				if (runtimeWorker.organizationId !== session.activeOrganizationId) {
					ws.close();
					return;
				}

				if (!runtimeWorker.sshKeyId)
					throw new Error("No SSH key available for this runtimeWorker");

				const conn = new Client();
				let _stdout = "";
				let _stderr = "";
				conn
					.once("ready", () => {
						// Use array-style arguments to prevent shell injection
						const dockerCommand = [
							"docker",
							"exec",
							"-it",
							"-w",
							"/",
							containerId,
							shell,
						].join(" ");
						conn.exec(dockerCommand, { pty: true }, (err, stream) => {
							if (err) {
								console.error("SSH exec error:", err);
								ws.close();
								conn.end();
								return;
							}

							stream
								.on("close", (code: number, _signal: string) => {
									ws.send(`\nContainer closed with code: ${code}\n`);
									conn.end();
								})
								.on("data", (data: string) => {
									_stdout += data.toString();
									ws.send(data.toString());
								})
								.stderr.on("data", (data) => {
									_stderr += data.toString();
									ws.send(data.toString());
									console.error("Error: ", data.toString());
								});

							ws.on("message", (message) => {
								try {
									let command: string | Buffer[] | Buffer | ArrayBuffer;
									if (Buffer.isBuffer(message)) {
										command = message.toString("utf8");
									} else {
										command = message;
									}
									stream.write(command.toString());
								} catch (error) {
									// @ts-expect-error
									const errorMessage = error?.message as unknown as string;
									ws.send(errorMessage);
								}
							});

							ws.on("close", () => {
								stream.end();
								// Ensure SSH connection is closed when WebSocket closes
								conn.end();
							});
						});
					})
					.on("error", (err) => {
						console.error("SSH connection error:", err);
						if (ws.readyState === ws.OPEN) {
							ws.send(`SSH error: ${err.message}`);
							ws.close();
						}
						conn.end();
					})
					.connect({
						host: runtimeWorker.ipAddress,
						port: runtimeWorker.port,
						username: runtimeWorker.username,
						privateKey: runtimeWorker.sshKey?.privateKey,
					});
			} else {
				const ptyProcess = spawn(
					"docker",
					["exec", "-it", "-w", "/", containerId, shell],
					{},
				);

				ptyProcess.onData((data) => {
					ws.send(data);
				});
				ws.on("close", () => {
					ptyProcess.kill();
				});
				ws.on("message", (message) => {
					try {
						let command: string | Buffer[] | Buffer | ArrayBuffer;
						if (Buffer.isBuffer(message)) {
							command = message.toString("utf8");
						} else {
							command = message;
						}
						ptyProcess.write(command.toString());
					} catch (error) {
						// @ts-expect-error
						const errorMessage = error?.message as unknown as string;
						ws.send(errorMessage);
					}
				});
			}
		} catch (error) {
			// @ts-expect-error
			const errorMessage = error?.message as unknown as string;

			ws.send(errorMessage);
		}
	});
};
