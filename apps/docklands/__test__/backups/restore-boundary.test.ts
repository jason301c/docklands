import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRestoreBackup } from "@/server/core/db/schema";

const findDestinationById = vi.hoisted(() => vi.fn());
const findDatabaseById = vi.hoisted(() => vi.fn());
const findComposeById = vi.hoisted(() => vi.fn());
const checkServicePermissionAndAccess = vi.hoisted(() => vi.fn());
const restoreDatabaseBackup = vi.hoisted(() => vi.fn());
const restoreComposeBackup = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/services/destination", () => ({
	findDestinationById,
}));

vi.mock("@/server/core/services/database", () => ({
	findDatabaseById,
}));

vi.mock("@/server/core/services/compose", () => ({
	findComposeByBackupId: vi.fn(),
	findComposeById,
}));

vi.mock("@/server/core/services/permission", () => ({
	checkServicePermissionAndAccess,
}));

vi.mock("@/server/core/utils/restore", () => ({
	restoreDatabaseBackup,
	restoreComposeBackup,
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit,
}));

vi.mock("@/server/core/services/backup", () => ({
	createBackup: vi.fn(),
	findBackupById: vi.fn(),
	removeBackupById: vi.fn(),
	updateBackupById: vi.fn(),
}));

vi.mock("@/server/core/services/runtime-worker", () => ({
	findRuntimeWorkerById: vi.fn(),
}));

vi.mock("@/server/core/utils/backups/compose", () => ({
	runComposeBackup: vi.fn(),
}));

vi.mock("@/server/core/utils/backups/database", () => ({
	runDatabaseBackup: vi.fn(),
}));

vi.mock("@/server/core/utils/backups/index", () => ({
	keepLatestNBackups: vi.fn(),
}));

vi.mock("@/server/core/utils/backups/utils", () => ({
	getS3Credentials: vi.fn(() => []),
	normalizeS3Path: vi.fn((value: string) => value),
	removeScheduleBackup: vi.fn(),
	scheduleBackup: vi.fn(),
}));

vi.mock("@/server/core/utils/backups/web-server", () => ({
	runWebServerBackup: vi.fn(),
}));

vi.mock("@/server/core/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
}));

import { backupRouter } from "@/server/api/routers/backup";

const ctx = {
	session: { activeOrganizationId: "org-1", userId: "user-1" },
	user: { id: "user-1", role: "owner" },
	db: {},
	req: { headers: {} },
	res: { headers: new Headers() },
} as any;

const caller = backupRouter.createCaller(ctx);

const baseRestoreInput = {
	databaseId: "db-1",
	databaseType: "postgres" as const,
	backupType: "database" as const,
	databaseName: "app",
	backupFile: "app/prefix/backup.sql.gz",
	destinationId: "dest-1",
};

describe("restore backup input boundary", () => {
	it("accepts nested safe database backup object keys", () => {
		const result = apiRestoreBackup.safeParse(baseRestoreInput);

		expect(result.success).toBe(true);
	});

	it("accepts nested safe web-server zip object keys", () => {
		const result = apiRestoreBackup.safeParse({
			...baseRestoreInput,
			databaseType: "web-server",
			backupFile: "docklands/prefix/webserver-backup-2026-06-25.zip",
		});

		expect(result.success).toBe(true);
	});

	it("rejects command-substitution backup object keys", () => {
		const result = apiRestoreBackup.safeParse({
			...baseRestoreInput,
			backupFile: "app/prefix/backup.sql.gz$(touch-owned)",
		});

		expect(result.success).toBe(false);
	});

	it("rejects traversal backup object keys", () => {
		const result = apiRestoreBackup.safeParse({
			...baseRestoreInput,
			backupFile: "../backup.sql.gz",
		});

		expect(result.success).toBe(false);
	});

	it("rejects an empty restore target id", () => {
		const result = apiRestoreBackup.safeParse({
			...baseRestoreInput,
			databaseId: "",
		});

		expect(result.success).toBe(false);
	});
});

describe("backup router restore boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		checkServicePermissionAndAccess.mockResolvedValue(undefined);
		findDestinationById.mockResolvedValue({
			destinationId: "dest-1",
			organizationId: "org-1",
		});
		findDatabaseById.mockResolvedValue({ databaseId: "db-1" });
		restoreDatabaseBackup.mockResolvedValue(undefined);
		restoreComposeBackup.mockResolvedValue(undefined);
		audit.mockResolvedValue(undefined);
	});

	it("rejects whole-instance web-server restore through the live mutation before side effects", async () => {
		await expect(
			caller.restoreBackup({
				...baseRestoreInput,
				databaseType: "web-server",
				backupFile: "docklands/webserver-backup-2026-06-25.zip",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("offline"),
		});

		expect(checkServicePermissionAndAccess).not.toHaveBeenCalled();
		expect(findDestinationById).not.toHaveBeenCalled();
		expect(restoreDatabaseBackup).not.toHaveBeenCalled();
	});

	it("rejects whole-instance web-server restore through the live subscription before side effects", async () => {
		const stream = await caller.restoreBackupWithLogs({
			...baseRestoreInput,
			databaseType: "web-server",
			backupFile: "docklands/webserver-backup-2026-06-25.zip",
		});

		await expect(async () => {
			for await (const _line of stream) {
				// The procedure throws before yielding.
			}
		}).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("offline"),
		});

		expect(checkServicePermissionAndAccess).not.toHaveBeenCalled();
		expect(findDestinationById).not.toHaveBeenCalled();
		expect(restoreDatabaseBackup).not.toHaveBeenCalled();
	});

	it("rejects restore to a destination outside the active organization", async () => {
		findDestinationById.mockResolvedValue({
			destinationId: "dest-other",
			organizationId: "org-other",
		});

		await expect(caller.restoreBackup(baseRestoreInput)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "You don't have access to this destination.",
		});

		expect(checkServicePermissionAndAccess).toHaveBeenCalledWith(ctx, "db-1", {
			backup: ["restore"],
		});
		expect(findDatabaseById).not.toHaveBeenCalled();
		expect(restoreDatabaseBackup).not.toHaveBeenCalled();
	});

	it("runs normal database restore after service and destination checks pass", async () => {
		const result = await caller.restoreBackup(baseRestoreInput);

		expect(result).toEqual({ success: true, logs: [] });
		expect(checkServicePermissionAndAccess).toHaveBeenCalledWith(ctx, "db-1", {
			backup: ["restore"],
		});
		expect(findDestinationById).toHaveBeenCalledWith("dest-1");
		expect(findDatabaseById).toHaveBeenCalledWith("db-1");
		expect(restoreDatabaseBackup).toHaveBeenCalled();
		expect(audit).toHaveBeenCalledWith(ctx, {
			action: "restore",
			resourceType: "backup",
			resourceId: "db-1",
		});
	});
});

describe("offline restore command guard", () => {
	it("uses a TRPCError for live web-server restore rejection", async () => {
		await expect(
			caller.restoreBackup({
				...baseRestoreInput,
				databaseType: "web-server",
				backupFile: "docklands/webserver-backup-2026-06-25.zip",
			}),
		).rejects.toBeInstanceOf(TRPCError);
	});
});
