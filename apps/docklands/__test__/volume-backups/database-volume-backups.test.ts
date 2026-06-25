import { describe, expect, it, vi } from "vitest";
import { restoreVolumeBackupSchema } from "@/server/core/db/schema";
import { backupVolume } from "@/server/core/utils/volume-backups/backup";

vi.mock("@/server/core/services/destination", () => ({
	findDestinationById: vi.fn().mockResolvedValue({
		accessKey: "access",
		bucket: "bucket",
		destinationId: "dest-1",
		endpoint: "https://s3.example.com",
		name: "Backups",
		provider: "AWS",
		region: "us-east-1",
		secretAccessKey: "secret",
	}),
}));

describe("managed database volume backups", () => {
	const volumeBackup = {
		appName: "backup-task",
		application: null,
		compose: null,
		database: {
			appName: "libsql-db",
			runtimeWorkerId: "worker-1",
		},
		destinationId: "dest-1",
		keepLatestCount: null,
		prefix: "daily",
		serviceName: null,
		serviceType: "libsql",
		turnOff: true,
		volumeName: "libsql-data",
	};

	it("accepts managed database service types for volume restore", () => {
		expect(
			restoreVolumeBackupSchema.safeParse({
				backupFileName: "libsql-db/daily/libsql-data-2026.tar",
				destinationId: "dest-1",
				id: "database-1",
				serviceType: "libsql",
				volumeName: "libsql-data",
			}).success,
		).toBe(true);
	});

	it("scales database services down and back up when stop-during-backup is enabled", async () => {
		const script = await backupVolume(volumeBackup as never);

		expect(script).toContain(
			'docker service inspect libsql-db --format "{{.Spec.Mode.Replicated.Replicas}}"',
		);
		expect(script).toContain("docker service update --replicas=0 libsql-db");
		expect(script).toContain(
			"docker service update --replicas=$ACTUAL_REPLICAS --with-registry-auth libsql-db",
		);
		expect(script).toContain("-v libsql-data:/volume_data");
		expect(script).not.toContain("undefined");
	});
});
