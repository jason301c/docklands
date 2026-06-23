import { createWriteStream } from "node:fs";
import path from "node:path";
import { scheduledJobs, scheduleJob as scheduleJobNode } from "node-schedule";
import { paths } from "@/server/core/constants/paths";
import type { Schedule } from "@/server/core/db/schema/schedule";
import { createLogger } from "@/server/core/lib/logger";
import {
	createDeploymentSchedule,
	updateDeployment,
	updateDeploymentStatus,
} from "@/server/core/services/deployment";
import { findScheduleById } from "@/server/core/services/schedule";
import { getComposeContainer, getServiceContainer } from "../docker/utils";
import { execAsyncRemote } from "../process/execAsync";
import { spawnAsync } from "../process/spawnAsync";

const logger = createLogger("schedule");

export const scheduleJob = (schedule: Schedule) => {
	const { cronExpression, scheduleId, timezone } = schedule;

	// Use timezone from schedule, default to UTC if not specified
	const tz = timezone || "UTC";

	scheduleJobNode(
		scheduleId,
		{
			tz,
			rule: cronExpression,
		},
		async () => {
			await runCommand(scheduleId);
		},
	);
};

export const removeScheduleJob = (scheduleId: string) => {
	const currentJob = scheduledJobs[scheduleId];
	currentJob?.cancel();
};

export const runCommand = async (scheduleId: string) => {
	const {
		application,
		command,
		shellType,
		scheduleType,
		compose,
		serviceName,
		appName,
		runtimeWorkerId,
	} = await findScheduleById(scheduleId);

	const deployment = await createDeploymentSchedule({
		scheduleId,
		title: "Schedule",
		description: "Schedule",
	});

	logger.info({ scheduleId, scheduleType, appName }, "Schedule run started");

	if (scheduleType === "application" || scheduleType === "compose") {
		let containerId = "";
		let runtimeWorkerId = "";
		if (scheduleType === "application" && application) {
			const container = await getServiceContainer(
				application.appName,
				application.runtimeWorkerId,
			);
			containerId = container?.Id || "";
			runtimeWorkerId = application.runtimeWorkerId || "";
		}
		if (scheduleType === "compose" && compose) {
			const container = await getComposeContainer(compose, serviceName || "");
			containerId = container?.Id || "";
			runtimeWorkerId = compose.runtimeWorkerId || "";
		}

		if (runtimeWorkerId) {
			try {
				await execAsyncRemote(
					runtimeWorkerId,
					`
					set -e
					echo "Running command: docker exec ${containerId} ${shellType} -c '${command}'" >> ${deployment.logPath};
					docker exec ${containerId} ${shellType} -c '${command}' >> ${deployment.logPath} 2>> ${deployment.logPath} || {
						echo "❌ Command failed" >> ${deployment.logPath};
						exit 1;
					}
					echo "✅ Command executed successfully" >> ${deployment.logPath};
					`,
				);
			} catch (error) {
				logger.error(
					{ err: error, scheduleId, containerId, runtimeWorkerId },
					"Remote schedule command failed",
				);
				await updateDeploymentStatus(deployment.deploymentId, "error");
				throw error;
			}
		} else {
			const writeStream = createWriteStream(deployment.logPath, { flags: "a" });

			try {
				writeStream.write(
					`docker exec ${containerId} ${shellType} -c ${command}\n`,
				);
				await spawnAsync(
					"docker",
					["exec", containerId, shellType, "-c", command],
					(data) => {
						if (writeStream.writable) {
							writeStream.write(data);
						}
					},
				);

				writeStream.write("✅ Command executed successfully\n");
			} catch (error) {
				writeStream.write("❌ Command failed\n");
				writeStream.write(
					error instanceof Error ? error.message : "Unknown error",
				);
				writeStream.end();
				logger.error(
					{ err: error, scheduleId, containerId },
					"Local schedule command failed",
				);
				await updateDeploymentStatus(deployment.deploymentId, "error");
				throw error;
			}
		}
	} else if (scheduleType === "docklands-server") {
		try {
			const writeStream = createWriteStream(deployment.logPath, { flags: "a" });
			const { SCHEDULES_PATH } = paths();
			const fullPath = path.join(SCHEDULES_PATH, appName || "");

			await spawnAsync(
				"bash",
				["-c", "./script.sh"],
				async (data) => {
					if (writeStream.writable) {
						// we need to extract the PID and Schedule ID from the data
						const pid = data?.match(/PID: (\d+)/)?.[1];

						if (pid) {
							await updateDeployment(deployment.deploymentId, {
								pid,
							});
						}
						writeStream.write(data);
					}
				},
				{
					cwd: fullPath,
				},
			);
		} catch (error) {
			logger.error(
				{ err: error, scheduleId, appName },
				"Server schedule script failed",
			);
			await updateDeploymentStatus(deployment.deploymentId, "error");
			throw error;
		}
	} else if (scheduleType === "runtimeWorker") {
		try {
			const { SCHEDULES_PATH } = paths(true);
			const fullPath = path.join(SCHEDULES_PATH, appName || "");
			const command = `
				set -e
				echo "Running script" >> ${deployment.logPath};
				bash -c ${fullPath}/script.sh 2>&1 | tee -a ${deployment.logPath} || {
					echo "❌ Command failed" >> ${deployment.logPath};
					exit 1;
				  }
				echo "✅ Command executed successfully" >> ${deployment.logPath};
			`;
			await execAsyncRemote(runtimeWorkerId, command, async (data) => {
				// we need to extract the PID and Schedule ID from the data
				const pid = data?.match(/PID: (\d+)/)?.[1];
				if (pid) {
					await updateDeployment(deployment.deploymentId, {
						pid,
					});
				}
			});
		} catch (error) {
			logger.error(
				{ err: error, scheduleId, runtimeWorkerId, appName },
				"Remote worker schedule script failed",
			);
			await updateDeploymentStatus(deployment.deploymentId, "error");
			throw error;
		}
	}
	logger.info({ scheduleId, scheduleType }, "Schedule run completed");
	await updateDeploymentStatus(deployment.deploymentId, "done");
};
