import path from "node:path";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import { findComposeById } from "@/server/core/services/compose";
import { findDestinationById } from "@/server/core/services/destination";
import type { findVolumeBackupById } from "@/server/core/services/volume-backups";
import {
	getBackupTimestamp,
	getS3CredentialEnv,
	getS3Credentials,
	normalizeS3Path,
} from "../backups/utils";

const logger = createLogger("volume-backup");

export const getVolumeServiceAppName = (
	volumeBackup: Awaited<ReturnType<typeof findVolumeBackupById>>,
): string => {
	if (volumeBackup.compose?.appName) {
		return volumeBackup.serviceName
			? `${volumeBackup.compose.appName}_${volumeBackup.serviceName}`
			: volumeBackup.compose.appName;
	}
	const serviceAppName =
		volumeBackup.application?.appName || volumeBackup.database?.appName;
	return serviceAppName || volumeBackup.appName;
};

export const backupVolume = async (
	volumeBackup: Awaited<ReturnType<typeof findVolumeBackupById>>,
) => {
	const { serviceType, volumeName, turnOff, prefix } = volumeBackup;
	const destination = await findDestinationById(volumeBackup.destinationId);
	const runtimeWorkerId =
		volumeBackup.application?.runtimeWorkerId ||
		volumeBackup.compose?.runtimeWorkerId ||
		volumeBackup.database?.runtimeWorkerId;
	const { VOLUME_BACKUPS_PATH, VOLUME_BACKUP_LOCK_PATH } = paths(
		!!runtimeWorkerId,
	);
	const s3AppName = getVolumeServiceAppName(volumeBackup);
	const backupFileName = `${volumeName}-${getBackupTimestamp()}.tar`;
	const bucketDestination = `${s3AppName}/${normalizeS3Path(prefix || "")}${backupFileName}`;
	const rcloneFlags = getS3Credentials(destination);
	const s3Env = getS3CredentialEnv(destination);
	const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;
	const volumeBackupPath = path.join(VOLUME_BACKUPS_PATH, volumeBackup.appName);

	const rcloneCommand = `${s3Env} rclone copyto ${rcloneFlags.join(" ")} "${volumeBackupPath}/${backupFileName}" "${rcloneDestination}"`;

	const backupCommand = `
	set -e
	echo "Volume name: ${volumeName}"
	echo "Backup file name: ${backupFileName}"
	echo "Turning off volume backup: ${turnOff ? "Yes" : "No"}"
	echo "Starting volume backup" 
	echo "Dir: ${volumeBackupPath}"
    docker run --rm \
  -v ${volumeName}:/volume_data \
  -v ${volumeBackupPath}:/backup \
  ubuntu \
  bash -c "cd /volume_data && tar cvf /backup/${backupFileName} ."
  echo "Volume backup done ✅"
  `;

	const uploadCommand = `
  echo "Starting upload to S3..."
  ${rcloneCommand}
  echo "Upload to S3 done ✅"
  echo "Cleaning up local backup file..."
  rm "${volumeBackupPath}/${backupFileName}"
  echo "Local backup file cleaned up ✅"
  `;

	if (!turnOff) {
		return `
		${backupCommand}
		${uploadCommand}
		`;
	}

	const serviceLockId =
		serviceType === "application"
			? volumeBackup.application?.appName
			: serviceType === "compose"
				? `${volumeBackup.compose?.appName}_${volumeBackup.serviceName}`
				: volumeBackup.database?.appName;

	const lockPath = `${VOLUME_BACKUP_LOCK_PATH}-${serviceLockId}`;

	const lockWrapper = (body: string) => `
		set -e

		LOCK_PATH="${lockPath}"

		echo "Waiting for volume backup lock: $LOCK_PATH"

		if command -v flock >/dev/null 2>&1; then
			exec 9>"$LOCK_PATH"
			flock 9
		else
			LOCK_DIR="$LOCK_PATH.dir"
			while ! mkdir "$LOCK_DIR" 2>/dev/null; do
				echo "Waiting for volume backup lock: $LOCK_PATH"
				sleep 5
			done
			trap 'rm -rf "$LOCK_DIR"' EXIT
		fi

		echo "Volume backup lock acquired"

		${body}

		echo "Volume backup lock released"
	`;

	logger.info(
		{
			appName:
				volumeBackup.application?.appName || volumeBackup.database?.appName,
			turnOff: true,
		},
		"Stopping service replicas for volume backup",
	);

	if (serviceType === "application" || volumeBackup.database) {
		const serviceAppName =
			serviceType === "application"
				? volumeBackup.application?.appName
				: volumeBackup.database?.appName;
		if (!serviceAppName) {
			throw new Error("Volume backup service app name not found");
		}

		return lockWrapper(`
		echo "Stopping service to 0 replicas"
		ACTUAL_REPLICAS=$(docker service inspect ${serviceAppName} --format "{{.Spec.Mode.Replicated.Replicas}}")
		echo "Actual replicas: $ACTUAL_REPLICAS"
		# Always restore replicas on exit so a failed backup never leaves the
		# service scaled to zero. The explicit restore below brings it back sooner
		# on success; this trap is the safety net for the failure path.
		trap 'docker service update --replicas=$ACTUAL_REPLICAS --with-registry-auth ${serviceAppName} || true' EXIT
		docker service update --replicas=0 ${serviceAppName}
        ${backupCommand}
		echo "Starting service to $ACTUAL_REPLICAS replicas"
        docker service update --replicas=$ACTUAL_REPLICAS --with-registry-auth ${serviceAppName}
		${uploadCommand}
  `);
	}
	if (serviceType === "compose") {
		const compose = await findComposeById(
			volumeBackup.compose?.composeId || "",
		);
		let stopCommand = "";
		let startCommand = "";

		if (compose.composeType === "stack") {
			stopCommand = `
			echo "Stopping compose to 0 replicas"
			echo "Service name: ${compose.appName}_${volumeBackup.serviceName}"
            ACTUAL_REPLICAS=$(docker service inspect ${compose.appName}_${volumeBackup.serviceName} --format "{{.Spec.Mode.Replicated.Replicas}}")
            echo "Actual replicas: $ACTUAL_REPLICAS"
            # Restore replicas on exit so a failed backup can't leave it at zero.
            trap 'docker service update --replicas=$ACTUAL_REPLICAS --with-registry-auth ${compose.appName}_${volumeBackup.serviceName} || true' EXIT
            docker service update --replicas=0 ${compose.appName}_${volumeBackup.serviceName}`;

			startCommand = `
			echo "Starting compose to $ACTUAL_REPLICAS replicas"
			docker service update --replicas=$ACTUAL_REPLICAS --with-registry-auth ${compose.appName}_${volumeBackup.serviceName}`;
		} else {
			stopCommand = `
			echo "Stopping compose container"
            ID=$(docker ps -q --filter "label=com.docker.compose.workspace=${compose.appName}" --filter "label=com.docker.compose.service=${volumeBackup.serviceName}")
            # Restart the container on exit so a failed backup can't leave it stopped.
            trap 'docker start $ID || true' EXIT
            docker stop $ID`;

			startCommand = `
            echo "Starting compose container"
            docker start $ID
			echo "Compose container started"
			`;
		}
		return lockWrapper(`
        ${stopCommand}
        ${backupCommand}
        ${startCommand}
		${uploadCommand}
  `);
	}

	throw new Error(`Unsupported volume backup service type: ${serviceType}`);
};
