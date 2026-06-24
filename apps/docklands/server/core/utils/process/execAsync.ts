import { exec, execFile } from "node:child_process";
import util from "node:util";
import { Client } from "ssh2";
import { createLogger } from "@/server/core/lib/logger";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { ExecError } from "./ExecError";
import { redactSecrets } from "./redactSecrets";
import { createHostVerifier } from "./ssh-host-key";

// Cap a remote command so a wedged build can't hang its queue group forever. An
// hour is generous for real builds while still bounding the failure mode.
const REMOTE_COMMAND_TIMEOUT_MS = 60 * 60 * 1000;

const logger = createLogger("process");

// Re-export ExecError for easier imports
export { ExecError } from "./ExecError";

const execAsyncBase = util.promisify(exec);

export const execAsync = async (
	command: string,
	options?: { cwd?: string; env?: NodeJS.ProcessEnv; shell?: string },
): Promise<{ stdout: string; stderr: string }> => {
	try {
		const result = await execAsyncBase(command, options);
		return {
			stdout: result.stdout.toString(),
			stderr: result.stderr.toString(),
		};
	} catch (error) {
		if (error instanceof Error) {
			// @ts-expect-error - exec error has these properties
			const exitCode = error.code;
			// @ts-expect-error
			const stdout = error.stdout?.toString() || "";
			// @ts-expect-error
			const stderr = error.stderr?.toString() || "";

			throw new ExecError(`Command execution failed: ${error.message}`, {
				command,
				stdout,
				stderr,
				exitCode,
				originalError: error,
			});
		}
		throw error;
	}
};

interface ExecOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
}

export const execAsyncStream = (
	command: string,
	onData?: (data: string) => void,
	options: ExecOptions = {},
): Promise<{ stdout: string; stderr: string }> => {
	return new Promise((resolve, reject) => {
		let stdoutComplete = "";
		let stderrComplete = "";

		const childProcess = exec(command, options, (error) => {
			if (error) {
				reject(
					new ExecError(`Command execution failed: ${error.message}`, {
						command,
						stdout: stdoutComplete,
						stderr: stderrComplete,
						// @ts-expect-error
						exitCode: error.code,
						originalError: error,
					}),
				);
				return;
			}
			resolve({ stdout: stdoutComplete, stderr: stderrComplete });
		});

		childProcess.stdout?.on("data", (data: Buffer | string) => {
			const stringData = data.toString();
			stdoutComplete += stringData;
			// Redact secrets in the live stream; the raw accumulator feeds ExecError,
			// which redacts at its own boundary.
			onData?.(redactSecrets(stringData));
		});

		childProcess.stderr?.on("data", (data: Buffer | string) => {
			const stringData = data.toString();
			stderrComplete += stringData;
			onData?.(redactSecrets(stringData));
		});

		childProcess.on("error", (error) => {
			// ExecError redacts command/stderr; log the wrapped form, not the raw error.
			const execError = new ExecError(
				`Command execution error: ${error.message}`,
				{
					command,
					stdout: stdoutComplete,
					stderr: stderrComplete,
					originalError: error,
				},
			);
			logger.error({ err: execError }, "Streamed command failed to spawn");
			reject(execError);
		});
	});
};

export const execFileAsync = async (
	command: string,
	args: string[],
	options: { input?: string } = {},
): Promise<{ stdout: string; stderr: string }> => {
	const child = execFile(command, args);

	if (options.input && child.stdin) {
		child.stdin.write(options.input);
		child.stdin.end();
	}

	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				reject(
					new ExecError(`Command failed with code ${code}`, {
						command,
						stdout,
						stderr,
						exitCode: code ?? undefined,
					}),
				);
			}
		});

		child.on("error", reject);
	});
};

export const execAsyncRemote = async (
	runtimeWorkerId: string | null,
	command: string,
	onData?: (data: string) => void,
	timeoutMs: number = REMOTE_COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> => {
	if (!runtimeWorkerId) return { stdout: "", stderr: "" };
	const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
	if (!runtimeWorker.sshKeyId)
		throw new Error("No SSH key available for this runtimeWorker");

	let stdout = "";
	let stderr = "";
	// Redact secrets in the live stream before it reaches the deployment log /
	// WebSocket; raw output is still kept in stdout/stderr for ExecError, which
	// redacts at its own boundary.
	const emit = (data: string) => onData?.(redactSecrets(data));
	return new Promise((resolve, reject) => {
		const conn = new Client();
		// Settle exactly once and always tear down the connection + timer, so a
		// timeout, error, and close can't double-resolve or leak the socket/timer.
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const settle = (action: () => void) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			conn.end();
			action();
		};
		timer = setTimeout(() => {
			settle(() =>
				reject(
					new ExecError(`Remote command timed out after ${timeoutMs}ms`, {
						command,
						stdout,
						stderr,
						runtimeWorkerId,
					}),
				),
			);
		}, timeoutMs);

		conn
			.once("ready", () => {
				conn.exec(command, (err, stream) => {
					if (err) {
						emit(err.message);
						settle(() =>
							reject(
								new ExecError(
									`Remote command execution failed: ${err.message}`,
									{
										command,
										runtimeWorkerId,
										originalError: err,
									},
								),
							),
						);
						return;
					}
					stream
						.on("close", (code: number, _signal: string) => {
							if (code === 0) {
								settle(() => resolve({ stdout, stderr }));
							} else {
								settle(() =>
									reject(
										new ExecError(
											`Remote command failed with exit code ${code}`,
											{
												command,
												stdout,
												stderr,
												exitCode: code,
												runtimeWorkerId,
											},
										),
									),
								);
							}
						})
						.on("data", (data: string) => {
							stdout += data.toString();
							emit(data.toString());
						})
						.stderr.on("data", (data) => {
							stderr += data.toString();
							emit(data.toString());
						});
				});
			})
			.on("error", (err) => {
				if (err.level === "client-authentication") {
					const technicalDetail = `Error: ${err.message} ${err.level}`;
					const friendlyMessage = [
						"",
						"❌ Couldn't connect to your runtimeWorker — the SSH key was not accepted.",
						"",
						"This usually means the key doesn't match what's on the runtimeWorker, or the key format is invalid.",
						"",
						`Technical details: ${technicalDetail}`,
						"",
						"💡 Hints:",
						"  • Check that the SSH key you added in Docklands is the same one installed on the runtimeWorker (e.g. in ~/.ssh/authorized_keys).",
						"  • Try generating a new SSH key in Docklands and add only the public key to the runtimeWorker, then try again.",
						"  • Make sure to follow the instructions on the Setup Server Button on the SSH Keys tab and then click on deployments tab and check the logs for more details.",
					].join("\n");
					emit(friendlyMessage);
					settle(() =>
						reject(
							new ExecError(
								`Authentication failed: Invalid SSH private key. ${friendlyMessage}`,
								{
									command,
									runtimeWorkerId,
									originalError: err,
								},
							),
						),
					);
				} else {
					const errorMsg = `SSH connection error: ${err.message}`;
					emit(errorMsg);
					settle(() =>
						reject(
							new ExecError(errorMsg, {
								command,
								runtimeWorkerId,
								originalError: err,
							}),
						),
					);
				}
			})
			.connect({
				host: runtimeWorker.ipAddress,
				port: runtimeWorker.port,
				username: runtimeWorker.username,
				privateKey: runtimeWorker.sshKey?.privateKey,
				// Pin/verify the worker's SSH host key (trust-on-first-use).
				hostVerifier: createHostVerifier(runtimeWorker),
				// SSH handshake timeout (ms). Generous enough for slow remote
				// workers, but not the old effectively-infinite ~100s.
				timeout: 30000,
			});
	});
};

export const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
