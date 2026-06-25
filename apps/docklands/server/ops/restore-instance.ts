import { parseArgs } from "node:util";
import {
	webServerRestoreBackupSchema,
	webServerRestoreConfirmation,
} from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { findDestinationById } from "@/server/core/services/destination";
import { restoreWebServerBackupOffline } from "@/server/core/utils/restore";

const logger = createLogger("ops:restore-instance");

const usage = `Usage:
  bun run restore-instance -- --destination-id <destination-id> --backup-file <object-key.zip> --confirm ${webServerRestoreConfirmation}

This is an offline disaster-recovery command. Stop the Docklands web process
before running it; the command replaces /etc/docklands data and drops/recreates
the Docklands database from the selected backup.`;

const fail = (message: string, error?: unknown) => {
	logger.fatal({ err: error }, message);
	console.error(message);
	console.error("");
	console.error(usage);
	process.exitCode = 1;
};

try {
	const { values } = parseArgs({
		options: {
			"destination-id": { type: "string" },
			"backup-file": { type: "string" },
			confirm: { type: "string" },
		},
		allowPositionals: false,
	});

	const parsed = webServerRestoreBackupSchema.safeParse({
		destinationId: values["destination-id"],
		backupFile: values["backup-file"],
		confirmation: values.confirm,
	});

	if (!parsed.success) {
		fail("Invalid restore-instance arguments.", parsed.error);
	} else {
		logger.warn(
			{
				destinationId: parsed.data.destinationId,
				backupFile: parsed.data.backupFile,
			},
			"Starting offline Docklands instance restore",
		);

		const destination = await findDestinationById(parsed.data.destinationId);
		await restoreWebServerBackupOffline(
			destination,
			parsed.data.backupFile,
			(log) => console.log(log),
		);
		logger.info("Offline Docklands instance restore completed");
	}
} catch (error) {
	fail(
		error instanceof Error
			? error.message
			: "Offline Docklands instance restore failed.",
		error,
	);
}
