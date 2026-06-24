import { quote } from "shell-quote";
import {
	getComposeContainerCommand,
	getServiceContainerCommand,
} from "../backups/utils";

// Like the backup commands, each restore runs as `docker exec … sh -c <script>`.
// The script is shell-quoted once (db name/user/password safe for the inner sh),
// then the whole script is quoted again as the single `sh -c` argument — so a
// value containing a quote/`;`/`|` cannot break out at either level.
export const getPostgresRestoreCommand = (
	database: string,
	databaseUser: string,
) => {
	const script = `pg_restore -U ${quote([databaseUser])} -d ${quote([database])} -O --clean --if-exists`;
	return `docker exec -i $CONTAINER_ID sh -c ${quote([script])}`;
};

export const getMariadbRestoreCommand = (
	database: string,
	databaseUser: string,
	databasePassword: string,
) => {
	const script = `mariadb -u ${quote([databaseUser])} -p${quote([databasePassword])} ${quote([database])}`;
	return `docker exec -i $CONTAINER_ID sh -c ${quote([script])}`;
};

export const getMysqlRestoreCommand = (
	database: string,
	databasePassword: string,
) => {
	const script = `mysql -u root -p${quote([databasePassword])} ${quote([database])}`;
	return `docker exec -i $CONTAINER_ID sh -c ${quote([script])}`;
};

export const getMongoRestoreCommand = (
	database: string,
	databaseUser: string,
	databasePassword: string,
) => {
	const script = `mongorestore --username ${quote([databaseUser])} --password ${quote([databasePassword])} --authenticationDatabase admin --db ${quote([database])} --archive --drop`;
	return `docker exec -i $CONTAINER_ID sh -c ${quote([script])}`;
};

export const getComposeSearchCommand = (
	appName: string,
	type: "stack" | "docker-compose" | "database",
	serviceName?: string,
) => {
	if (type === "database") {
		return getServiceContainerCommand(appName || "");
	}
	return getComposeContainerCommand(appName || "", serviceName || "", type);
};

interface DatabaseCredentials {
	database: string;
	databaseUser?: string;
	databasePassword?: string;
}

const generateRestoreCommand = (
	type: "postgres" | "mariadb" | "mysql" | "mongo",
	credentials: DatabaseCredentials,
) => {
	const { database, databaseUser, databasePassword } = credentials;
	switch (type) {
		case "postgres":
			return getPostgresRestoreCommand(database, databaseUser || "");
		case "mariadb":
			return getMariadbRestoreCommand(
				database,
				databaseUser || "",
				databasePassword || "",
			);
		case "mysql":
			return getMysqlRestoreCommand(database, databasePassword || "");
		case "mongo":
			return getMongoRestoreCommand(
				database,
				databaseUser || "",
				databasePassword || "",
			);
	}
};

const getMongoSpecificCommand = (
	rcloneCommand: string,
	restoreCommand: string,
	backupFile: string,
): string => {
	const tempDir = "/tmp/docklands-restore";
	const fileName = backupFile.split("/").pop() || "backup.sql.gz";
	const decompressedName = fileName.replace(".gz", "");
	return `
rm -rf ${tempDir} && \
mkdir -p ${tempDir} && \
${rcloneCommand} ${tempDir} && \
cd ${tempDir} && \
gunzip -f ${quote([fileName])} && \
${restoreCommand} < ${quote([decompressedName])} && \
rm -rf ${tempDir}
	`;
};

interface RestoreOptions {
	appName: string;
	type: "postgres" | "mariadb" | "mysql" | "mongo";
	restoreType: "stack" | "docker-compose" | "database";
	credentials: DatabaseCredentials;
	serviceName?: string;
	rcloneCommand: string;
	backupFile?: string;
}

export const getRestoreCommand = ({
	appName,
	type,
	restoreType,
	credentials,
	serviceName,
	rcloneCommand,
	backupFile,
}: RestoreOptions) => {
	const containerSearch = getComposeSearchCommand(
		appName,
		restoreType,
		serviceName,
	);
	const restoreCommand = generateRestoreCommand(type, credentials);
	let cmd = `CONTAINER_ID=$(${containerSearch})`;

	if (type !== "mongo") {
		cmd += ` && ${rcloneCommand} | ${restoreCommand}`;
	} else {
		cmd += ` && ${getMongoSpecificCommand(rcloneCommand, restoreCommand, backupFile || "")}`;
	}

	return cmd;
};
