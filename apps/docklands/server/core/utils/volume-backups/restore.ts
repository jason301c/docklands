import path from "node:path";
import { quote } from "shell-quote";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import { findApplicationById } from "@/server/core/services/application";
import { findComposeById } from "@/server/core/services/compose";
import { findDatabaseById } from "@/server/core/services/database";
import { findDestinationById } from "@/server/core/services/destination";
import {
	getS3CredentialEnv,
	getS3Credentials,
} from "@/server/core/utils/backups/utils";

const logger = createLogger("volume-backup");

type VolumeRestoreServiceType =
	| "application"
	| "compose"
	| "postgres"
	| "mysql"
	| "mariadb"
	| "mongo"
	| "redis"
	| "libsql";

type BuildVolumeRestoreScriptInput = {
	volumeName: string;
	backupFileName: string;
	localBackupFileName: string;
	volumeBackupPath: string;
	downloadCommand: string;
	headerLines: string[];
};

export const buildVolumeRestoreScript = ({
	volumeName,
	backupFileName,
	localBackupFileName,
	volumeBackupPath,
	downloadCommand,
	headerLines,
}: BuildVolumeRestoreScriptInput) => {
	const volumeNameArg = quote([volumeName]);
	const volumeMountArg = quote([`${volumeName}:/volume_data`]);
	const backupMountArg = quote([`${volumeBackupPath}:/backup`]);
	const volumeBackupPathArg = quote([volumeBackupPath]);
	const localBackupPathArg = quote([`/backup/${localBackupFileName}`]);
	const tarRestoreScript = `cd /volume_data && tar xvf ${localBackupPathArg} .`;

	const header = headerLines.map((line) => `echo ${quote([line])}`).join("\n");

	const baseRestoreCommand = `
	set -e
	echo ${quote([`Volume name: ${volumeName}`])}
	echo ${quote([`Backup file name: ${backupFileName}`])}
	echo ${quote([`Volume backup path: ${volumeBackupPath}`])}
	echo "Downloading backup from S3..."
	mkdir -p ${volumeBackupPathArg}
	${downloadCommand}
	echo "Download completed ✅"
	echo "Creating new volume and restoring data..."
	docker run --rm \
		-v ${volumeMountArg} \
		-v ${backupMountArg} \
		ubuntu \
		bash -c ${quote([tarRestoreScript])}
	echo "Volume restore completed ✅"
	`;

	const checkVolumeCommand = `
	# Check if volume exists
	VOLUME_EXISTS=$(docker volume ls -q --filter ${quote([`name=^${volumeName}$`])} | wc -l)
	echo "Volume exists: $VOLUME_EXISTS"
	
	if [ "$VOLUME_EXISTS" = "0" ]; then
		echo "Volume doesn't exist, proceeding with direct restore"
		${baseRestoreCommand}
	else
		echo "Volume exists, checking for containers using it (including stopped ones)..."
		
		# Get ALL containers (running and stopped) using this volume - much simpler with native filter!
		CONTAINERS_USING_VOLUME=$(docker ps -a --filter ${quote([`volume=${volumeName}`])} --format ${quote(["{{.ID}}|{{.Names}}|{{.State}}|{{.Labels}}"])})
		
		if [ -z "$CONTAINERS_USING_VOLUME" ]; then
			echo "Volume exists but no containers are using it"
			echo "Removing existing volume and proceeding with restore"
			docker volume rm ${volumeNameArg} --force
			${baseRestoreCommand}
		else
			echo ""
			echo "⚠️  WARNING: Cannot restore volume as it is currently in use!"
			echo ""
			echo ${quote([`📋 The following containers are using volume '${volumeName}':`])}
			echo ""
			
			echo "$CONTAINERS_USING_VOLUME" | while IFS='|' read container_id container_name container_state labels; do
				echo "   🐳 Container: $container_name ($container_id)"
				echo "      Status: $container_state"
				
				# Determine container type
				if echo "$labels" | grep -q "com.docker.swarm.service.name="; then
					SERVICE_NAME=$(echo "$labels" | grep -o "com.docker.swarm.service.name=[^,]*" | cut -d'=' -f2)
					echo "      Type: Docker Swarm Service ($SERVICE_NAME)"
				elif echo "$labels" | grep -q "com.docker.compose.workspace="; then
					PROJECT_NAME=$(echo "$labels" | grep -o "com.docker.compose.workspace=[^,]*" | cut -d'=' -f2)
					echo "      Type: Docker Compose ($PROJECT_NAME)"
				else
					echo "      Type: Regular Container"
				fi
				echo ""
			done
			
			echo ""
			echo "🔧 To restore this volume, please:"
			echo "   1. Stop all containers/services using this volume"
			echo ${quote([`   2. Remove the existing volume: docker volume rm ${volumeName}`])}
			echo "   3. Run the restore operation again"
			echo ""
			echo "❌ Volume restore aborted - volume is in use"
			
			exit 1
		fi
	fi
	`;

	return `
		${header}
		${checkVolumeCommand}
	`;
};

export const restoreVolume = async (
	id: string,
	destinationId: string,
	volumeName: string,
	backupFileName: string,
	runtimeWorkerId: string,
	serviceType: VolumeRestoreServiceType,
) => {
	logger.info(
		{ id, volumeName, serviceType },
		"Constructing volume restore command",
	);
	const destination = await findDestinationById(destinationId);
	const { VOLUME_BACKUPS_PATH } = paths(!!runtimeWorkerId);
	const volumeBackupPath = path.join(VOLUME_BACKUPS_PATH, volumeName);
	const rcloneFlags = getS3Credentials(destination);
	const s3Env = getS3CredentialEnv(destination);
	const bucketPath = `:s3:${destination.bucket}`;
	const backupPath = `${bucketPath}/${backupFileName}`;
	const localBackupFileName = path.posix.basename(backupFileName);
	const localBackupPath = path.join(volumeBackupPath, localBackupFileName);

	// Command to download backup file from S3
	const downloadCommand = `${s3Env} rclone copyto ${rcloneFlags.join(" ")} ${quote([backupPath])} ${quote([localBackupPath])}`;

	if (serviceType === "application") {
		const application = await findApplicationById(id);
		return buildVolumeRestoreScript({
			volumeName,
			backupFileName,
			localBackupFileName,
			volumeBackupPath,
			downloadCommand,
			headerLines: [
				"=== VOLUME RESTORE FOR APPLICATION ===",
				`Application: ${application.appName}`,
			],
		});
	}

	if (serviceType === "compose") {
		const compose = await findComposeById(id);

		return buildVolumeRestoreScript({
			volumeName,
			backupFileName,
			localBackupFileName,
			volumeBackupPath,
			downloadCommand,
			headerLines: [
				"=== VOLUME RESTORE FOR COMPOSE ===",
				`Compose: ${compose.appName}`,
				`Compose Type: ${compose.composeType}`,
			],
		});
	}

	const database = await findDatabaseById(id);
	return buildVolumeRestoreScript({
		volumeName,
		backupFileName,
		localBackupFileName,
		volumeBackupPath,
		downloadCommand,
		headerLines: [
			"=== VOLUME RESTORE FOR DATABASE ===",
			`Database: ${database.appName}`,
			`Engine: ${database.engine}`,
		],
	});
};
