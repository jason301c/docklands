import { execAsync, execAsyncRemote } from "../process/execAsync";

const destinationPathRegex = /^[a-zA-Z0-9.\-_/]+$/;

export const uploadFileToContainer = async (
	containerId: string,
	fileBuffer: Buffer,
	fileName: string,
	destinationPath: string,
	runtimeWorkerId?: string | null,
): Promise<void> => {
	const containerIdRegex = /^[a-zA-Z0-9.\-_]+$/;
	if (!containerIdRegex.test(containerId)) {
		throw new Error("Invalid container ID");
	}

	if (!destinationPathRegex.test(destinationPath)) {
		throw new Error(
			"Invalid destination path: shell metacharacters are not allowed",
		);
	}

	const normalizedPath = destinationPath.startsWith("/")
		? destinationPath
		: `/${destinationPath}`;

	const base64Content = fileBuffer.toString("base64");
	const tempFileName = `docklands-upload-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
	const tempPath = `/tmp/${tempFileName}`;

	const command = `echo '${base64Content}' | base64 -d > "${tempPath}" && docker cp "${tempPath}" "${containerId}:${normalizedPath}" ; rm -f "${tempPath}"`;

	try {
		if (runtimeWorkerId) {
			await execAsyncRemote(runtimeWorkerId, command);
		} else {
			await execAsync(command);
		}
	} catch (error) {
		throw new Error("Failed to upload file to container", { cause: error });
	}
};
