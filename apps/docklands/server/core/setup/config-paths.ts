import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { createLogger } from "@/server/core/lib/logger";
import { paths } from "../constants";

const logger = createLogger("setup:dirs");

const createDirectoryIfNotExist = (dirPath: string) => {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
		logger.debug({ path: dirPath }, "Directory created");
	}
};

export const setupDirectories = () => {
	const {
		APPLICATIONS_PATH,
		BASE_PATH,
		CERTIFICATES_PATH,
		DYNAMIC_TRAEFIK_PATH,
		LOGS_PATH,
		MAIN_TRAEFIK_PATH,
		MONITORING_PATH,
		SSH_PATH,
		SCHEDULES_PATH,
		VOLUME_BACKUPS_PATH,
	} = paths();
	const directories = [
		BASE_PATH,
		MAIN_TRAEFIK_PATH,
		DYNAMIC_TRAEFIK_PATH,
		LOGS_PATH,
		APPLICATIONS_PATH,
		SSH_PATH,
		CERTIFICATES_PATH,
		MONITORING_PATH,
		SCHEDULES_PATH,
		VOLUME_BACKUPS_PATH,
	];

	for (const dir of directories) {
		try {
			createDirectoryIfNotExist(dir);
			if (dir === SSH_PATH) {
				chmodSync(SSH_PATH, "700");
			}
		} catch (error) {
			logger.error({ err: error, path: dir }, "Failed to create directory");
		}
	}
};
