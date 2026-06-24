import fs from "node:fs/promises";
import path, { join } from "node:path";
import AdmZip from "adm-zip";
import { Client, type SFTPWrapper } from "ssh2";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import { readValidDirectory } from "@/server/core/runtime/host";
import type { Application } from "@/server/core/services/application";
import { findRuntimeWorkerById } from "@/server/core/services/runtime-worker";
import { createHostVerifier } from "@/server/core/utils/process/ssh-host-key";
import {
	recreateDirectory,
	recreateDirectoryRemote,
} from "../filesystem/directory";
import { execAsyncRemote } from "../process/execAsync";

const logger = createLogger("build");

export const unzipDrop = async (zipFile: File, application: Application) => {
	let sftp: SFTPWrapper | null = null;

	try {
		const { appName } = application;
		// Use buildRuntimeWorkerId if set, otherwise fall back to runtimeWorkerId
		// This ensures the code is extracted to the runtimeWorker where the build will run
		const targetRuntimeWorkerId =
			application.buildRuntimeWorkerId || application.runtimeWorkerId;
		const { APPLICATIONS_PATH } = paths(!!targetRuntimeWorkerId);
		const outputPath = join(APPLICATIONS_PATH, appName, "code");
		if (targetRuntimeWorkerId) {
			await recreateDirectoryRemote(outputPath, targetRuntimeWorkerId);
		} else {
			await recreateDirectory(outputPath);
		}
		const arrayBuffer = await zipFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const zip = new AdmZip(buffer);
		const zipEntries = zip
			.getEntries()
			.filter((entry) => !entry.entryName.startsWith("__MACOSX"));

		const rootEntries = zipEntries.filter(
			(entry) =>
				entry.entryName.split("/").length === 1 ||
				(entry.entryName.split("/").length === 2 &&
					entry.entryName.endsWith("/")),
		);

		const hasSingleRootFolder = !!(
			rootEntries.length === 1 && rootEntries[0]?.isDirectory
		);
		const rootFolderName = hasSingleRootFolder
			? rootEntries[0]?.entryName.split("/")[0]
			: "";

		if (targetRuntimeWorkerId) {
			sftp = await getSFTPConnection(targetRuntimeWorkerId);
		}
		for (const entry of zipEntries) {
			let filePath = entry.entryName;

			if (
				hasSingleRootFolder &&
				rootFolderName &&
				filePath.startsWith(`${rootFolderName}/`)
			) {
				filePath = filePath.slice(rootFolderName?.length + 1);
			}

			if (!filePath) continue;

			const fullPath = path.join(outputPath, filePath).replace(/\\/g, "/");
			if (!readValidDirectory(fullPath, application.runtimeWorkerId)) {
				throw new Error(
					`Path traversal detected: resolved path escapes output directory: ${filePath}`,
				);
			}

			if (isDangerousNode(entry)) {
				throw new Error(
					`Dangerous node entries are not allowed: ${entry.entryName}`,
				);
			}

			if (targetRuntimeWorkerId) {
				if (!entry.isDirectory) {
					if (sftp === null) throw new Error("No SFTP connection available");
					try {
						const dirPath = path.dirname(fullPath);
						await execAsyncRemote(
							targetRuntimeWorkerId,
							`mkdir -p "${dirPath}"`,
						);
						await uploadFileToServer(sftp, entry.getData(), fullPath);
					} catch (err) {
						logger.error({ err, path: fullPath }, "SFTP file upload failed");
						throw err;
					}
				}
			} else {
				if (entry.isDirectory) {
					await fs.mkdir(fullPath, { recursive: true });
				} else {
					await fs.mkdir(path.dirname(fullPath), { recursive: true });
					await fs.writeFile(fullPath, entry.getData());
				}
			}
		}
		logger.info(
			{ appName: application.appName, entryCount: zipEntries.length },
			"ZIP extracted successfully",
		);
	} catch (error) {
		logger.error(
			{ err: error, appName: application.appName },
			"ZIP extraction failed",
		);
		throw error;
	} finally {
		sftp?.end();
	}
};

const getSFTPConnection = async (
	runtimeWorkerId: string,
): Promise<SFTPWrapper> => {
	const runtimeWorker = await findRuntimeWorkerById(runtimeWorkerId);
	if (!runtimeWorker.sshKeyId)
		throw new Error("No SSH key available for this runtimeWorker");

	return new Promise((resolve, reject) => {
		const conn = new Client();
		conn
			.on("ready", () => {
				conn.sftp((err, sftp) => {
					if (err) {
						logger.error(
							{ err, runtimeWorkerId },
							"SFTP session creation failed",
						);
						return reject(err);
					}
					logger.debug({ runtimeWorkerId }, "SFTP connection established");
					resolve(sftp);
				});
			})
			.connect({
				host: runtimeWorker.ipAddress,
				port: runtimeWorker.port,
				username: runtimeWorker.username,
				privateKey: runtimeWorker.sshKey?.privateKey,
				hostVerifier: createHostVerifier(runtimeWorker),
			});
	});
};

const uploadFileToServer = (
	sftp: SFTPWrapper,
	data: Buffer,
	remotePath: string,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		sftp.writeFile(remotePath, data, (err) => {
			if (err) {
				logger.error({ err, path: remotePath }, "SFTP write failed");
				return reject(err);
			}
			resolve();
		});
	});
};

function isDangerousNode(entry: AdmZip.IZipEntry) {
	const type = (entry.header.attr >> 16) & 0o170000;

	return (
		type === 0o120000 || // symlink
		type === 0o060000 || // block device
		type === 0o020000 || // char device
		type === 0o010000 // fifo/pipe
	);
}
