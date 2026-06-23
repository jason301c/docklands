import {
	type ChildProcess,
	type SpawnOptions,
	spawn,
} from "node:child_process";
import BufferList from "bl";
import { redactSecrets } from "./redactSecrets";

export const spawnAsync = (
	command: string,
	args?: string[] | undefined,
	onData?: (data: string) => void, // Callback opcional para manejar datos en tiempo real
	options?: SpawnOptions,
): Promise<BufferList> & { child: ChildProcess } => {
	const child = spawn(command, args ?? [], options ?? {});
	const stdout = child.stdout ? new BufferList() : new BufferList();
	const stderr = child.stderr ? new BufferList() : new BufferList();

	if (child.stdout) {
		child.stdout.on("data", (data) => {
			stdout.append(data);
			if (onData) {
				onData(data.toString());
			}
		});
	}
	if (child.stderr) {
		child.stderr.on("data", (data) => {
			stderr.append(data);
			if (onData) {
				onData(data.toString());
			}
		});
	}

	const promise = new Promise<BufferList>((resolve, reject) => {
		child.on("error", reject);

		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				// Redact the message before it can reach logs / the deploy stream.
				// `execAsync` redacts via ExecError; `spawnAsync` must do the same so
				// SSH keys and base64 secrets embedded in shelled commands (e.g.
				// remote provisioning) never leak through the rejected error.
				const err = new Error(redactSecrets(stderr.toString())) as Error & {
					code: number;
					stderr: BufferList;
					stdout: BufferList;
				};
				err.code = code || -1;
				err.stderr = stderr;
				err.stdout = stdout;
				reject(err);
			}
		});
	}) as Promise<BufferList> & { child: ChildProcess };

	promise.child = child;

	return promise;
};
