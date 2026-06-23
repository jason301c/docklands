import type http from "node:http";
import { Client, type ConnectConfig } from "ssh2";
import { WebSocketServer } from "ws";
import { validateRequest } from "@/server/core/lib/auth";
import { createLogger } from "@/server/core/lib/logger";
import { getDockerHost } from "@/server/core/runtime/docker";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import {
	canAccessHostTerminalWs,
	getRuntimeWorkerIdParam,
	setupLocalServerSSHKey,
} from "./utils";

const logger = createLogger("wss-terminal");

const COMMAND_TO_ALLOW_LOCAL_ACCESS = `
# ----------------------------------------
mkdir -p $HOME/.ssh && \\
chmod 700 $HOME/.ssh && \\
touch $HOME/.ssh/authorized_keys && \\
chmod 600 $HOME/.ssh/authorized_keys && \\
cat /etc/docklands/ssh/auto_generated-docklands-local.pub >> $HOME/.ssh/authorized_keys && \\
echo "✓ Docklands SSH key added successfully. Reopen the terminal in Docklands to reconnect."
# ----------------------------------------`;

const COMMAND_TO_GRANT_PERMISSION_ACCESS = `
# ----------------------------------------
sudo chown -R $USER:$USER /etc/docklands/ssh
# ----------------------------------------
`;

export const setupTerminalWebSocketServer = (
	runtimeWorker: http.Server<
		typeof http.IncomingMessage,
		typeof http.ServerResponse
	>,
) => {
	const wssTerm = new WebSocketServer({
		noServer: true,
		path: "/terminal",
	});

	runtimeWorker.on("upgrade", (req, socket, head) => {
		const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);
		if (pathname === "/terminal") {
			wssTerm.handleUpgrade(req, socket, head, function done(ws) {
				wssTerm.emit("connection", ws, req);
			});
		}
	});

	wssTerm.on("connection", async (ws, req) => {
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const runtimeWorkerId = getRuntimeWorkerIdParam(url);
		const { user, session } = await validateRequest(req);
		if (!user || !session || !runtimeWorkerId) {
			ws.close();
			return;
		}

		// Host/runtime-worker shell access is owner/admin only.
		if (!canAccessHostTerminalWs(user)) {
			logger.warn(
				{ runtimeWorkerId, userId: user?.id },
				"host-terminal ws rejected: not owner/admin",
			);
			ws.close();
			return;
		}

		let connectionDetails: ConnectConfig = {};

		const isLocalServer = runtimeWorkerId === "local";

		if (isLocalServer) {
			const port = Number(url.searchParams.get("port"));
			const username = url.searchParams.get("username");

			if (!port || !username) {
				ws.close();
				return;
			}

			try {
				ws.send("Setting up private SSH key...\n");
				const privateKey = await setupLocalServerSSHKey();

				if (!privateKey) {
					ws.close();
					return;
				}

				const dockerHost = await getDockerHost();

				ws.send(`Found Docker host: ${dockerHost}\n`);

				connectionDetails = {
					host: dockerHost,
					port,
					username,
					privateKey,
				};
			} catch (error) {
				logger.error(
					{ err: error, runtimeWorkerId },
					"error setting up private SSH key",
				);
				ws.send(`Error setting up private SSH key: ${error}\n`);

				if (
					error instanceof Error &&
					error.message.includes("Permission denied")
				) {
					ws.send(
						`Please run the following command on your runtimeWorker to grant permission access and then reopen this window to reconnect:${COMMAND_TO_GRANT_PERMISSION_ACCESS}`,
					);
				}

				ws.close();
				return;
			}
		} else {
			const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);

			if (!runtimeWorker) {
				ws.close();
				return;
			}

			if (runtimeWorker.organizationId !== session.activeOrganizationId) {
				ws.close();
				return;
			}

			const {
				ipAddress: host,
				port,
				username,
				sshKey,
				sshKeyId,
			} = runtimeWorker;

			if (!sshKeyId) {
				logger.error(
					{ runtimeWorkerId },
					"no SSH key configured for remote worker terminal",
				);
				throw new Error("No SSH key available for this runtimeWorker");
			}

			connectionDetails = {
				host,
				port,
				username,
				privateKey: sshKey?.privateKey,
			};
		}

		const conn = new Client();
		let _stdout = "";
		let _stderr = "";

		ws.send("Connecting...\n");

		conn
			.once("ready", () => {
				// Clear terminal content once connected
				ws.send("\x1bc");

				conn.shell({}, (err, stream) => {
					if (err) {
						// ssh2 invokes this from its own I/O loop, outside the
						// surrounding try/Promise — throwing here would surface as an
						// uncaughtException and kill the whole single-process server.
						logger.error({ err, runtimeWorkerId }, "failed to open ssh shell");
						ws.send(`\nFailed to open shell: ${err.message}\n`);
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
							logger.debug({ runtimeWorkerId }, "ssh stderr chunk received");
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
					});
				});
			})
			.on("error", (err) => {
				if (err.level === "client-authentication") {
					if (isLocalServer) {
						ws.send(
							`Authentication failed: Please run the command below on your runtimeWorker to allow access. Make sure to run it as the same user as the one configured in connection settings:${COMMAND_TO_ALLOW_LOCAL_ACCESS}\nAfter running the command, reopen this window to reconnect. This procedure is required only once.`,
						);
					} else {
						ws.send(
							`Authentication failed: Unauthorized private SSH key or username.\n❌  Error: ${err.message} ${err.level}`,
						);
					}
				} else {
					ws.send(`SSH connection error: ${err.message} ❌ `);
				}
				conn.end();
			})
			.connect(connectionDetails);
	});
};
