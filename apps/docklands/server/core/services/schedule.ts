import path from "node:path";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { paths } from "../constants";
import { db } from "../db";
import type {
	createScheduleSchema,
	updateScheduleSchema,
} from "../db/schema/schedule";
import { type Schedule, schedules } from "../db/schema/schedule";
import { encodeBase64 } from "../utils/docker/utils";
import { execAsync, execAsyncRemote } from "../utils/process/execAsync";

export type ScheduleExtended = Awaited<ReturnType<typeof findScheduleById>>;

export const createSchedule = async (
	input: z.infer<typeof createScheduleSchema>,
) => {
	const { scheduleId, ...rest } = input;
	const [newSchedule] = await db
		.insert(schedules)
		.values(rest as typeof schedules.$inferInsert)
		.returning();

	if (
		newSchedule &&
		(newSchedule.scheduleType === "docklands-server" ||
			newSchedule.scheduleType === "runtimeWorker")
	) {
		await handleScript(newSchedule);
	}

	return newSchedule;
};

export const findScheduleById = async (scheduleId: string) => {
	const schedule = await db.query.schedules.findFirst({
		where: eq(schedules.scheduleId, scheduleId),
		with: {
			application: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			compose: {
				with: {
					environment: {
						with: {
							workspace: true,
						},
					},
				},
			},
			runtimeWorker: {
				with: {
					organization: true,
				},
			},
		},
	});

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}
	return schedule;
};

export const findScheduleOrganizationId = async (scheduleId: string) => {
	const schedule = await findScheduleById(scheduleId);

	if (schedule?.application) {
		return schedule?.application?.environment?.workspace?.organizationId;
	}
	if (schedule?.compose) {
		return schedule?.compose?.environment?.workspace?.organizationId;
	}
	if (schedule?.runtimeWorker) {
		return schedule?.runtimeWorker?.organization?.id;
	}
	if (schedule?.organizationId) {
		return schedule.organizationId;
	}
	return null;
};

export const deleteSchedule = async (scheduleId: string) => {
	const schedule = await findScheduleById(scheduleId);
	const runtimeWorkerId =
		schedule?.runtimeWorkerId ||
		schedule?.application?.runtimeWorkerId ||
		schedule?.compose?.runtimeWorkerId;
	const { SCHEDULES_PATH } = paths(!!runtimeWorkerId);

	const fullPath = path.join(SCHEDULES_PATH, schedule?.appName || "");
	const command = `rm -rf ${fullPath}`;
	if (runtimeWorkerId) {
		await execAsyncRemote(runtimeWorkerId, command);
	} else {
		await execAsync(command);
	}

	const scheduleResult = await db
		.delete(schedules)
		.where(eq(schedules.scheduleId, scheduleId));
	if (!scheduleResult) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}

	return true;
};

export const updateSchedule = async (
	input: z.infer<typeof updateScheduleSchema>,
) => {
	const { scheduleId, ...rest } = input;
	const [updatedSchedule] = await db
		.update(schedules)
		.set(rest as Partial<typeof schedules.$inferInsert>)
		.where(eq(schedules.scheduleId, scheduleId))
		.returning();

	if (!updatedSchedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}

	if (
		updatedSchedule?.scheduleType === "docklands-server" ||
		updatedSchedule?.scheduleType === "runtimeWorker"
	) {
		await handleScript(updatedSchedule);
	}

	return updatedSchedule;
};

const handleScript = async (schedule: Schedule) => {
	const { SCHEDULES_PATH } = paths(!!schedule?.runtimeWorkerId);
	const fullPath = path.join(SCHEDULES_PATH, schedule?.appName || "");

	// Add PID and Schedule ID echo by default to all scripts
	const scriptWithPid = `echo "PID: $$ | Schedule ID: ${schedule.scheduleId}"
${schedule?.script || ""}`;

	const encodedContent = encodeBase64(scriptWithPid);
	const script = `
	 	 mkdir -p ${fullPath}
	 	 rm -f ${fullPath}/script.sh
		 touch ${fullPath}/script.sh
		 chmod +x ${fullPath}/script.sh
		 echo "${encodedContent}" | base64 -d > ${fullPath}/script.sh
	`;

	if (schedule?.scheduleType === "docklands-server") {
		await execAsync(script);
	} else if (schedule?.scheduleType === "runtimeWorker") {
		await execAsyncRemote(schedule?.runtimeWorkerId || "", script);
	}
};
