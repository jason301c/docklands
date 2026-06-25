import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRestoreBackup } from "@/server/core/db/schema";

const findDestinationById = vi.hoisted(() => vi.fn());
const findDatabaseById = vi.hoisted(() => vi.fn());
const findComposeById = vi.hoisted(() => vi.fn());
const checkServicePermissionAndAccess = vi.hoisted(() => vi.fn());
const isOwnerOrAdmin = vi.hoisted(() =>
	vi.fn(
		(role: string | null | undefined) => role === "owner" || role === "admin",
	),
);
const createBackup = vi.hoisted(() => vi.fn());
const findBackupById = vi.hoisted(() => vi.fn());
const removeBackupById = vi.hoisted(() => vi.fn());
const updateBackupById = vi.hoisted(() => vi.fn());
const restoreDatabaseBackup = vi.hoisted(() => vi.fn());
const restoreComposeBackup = vi.hoisted(() => vi.fn());
const runWebServerBackup = vi.hoisted(() => vi.fn());
const keepLatestNBackups = vi.hoisted(() => vi.fn());
const removeScheduleBackup = vi.hoisted(() => vi.fn());
const scheduleBackup = vi.hoisted(() => vi.fn());
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
	isOwnerOrAdmin,
}));

vi.mock("@/server/core/utils/restore", () => ({
	restoreDatabaseBackup,
	restoreComposeBackup,
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit,
}));

vi.mock("@/server/core/services/backup", () => ({
	createBackup,
	findBackupById,
	removeBackupById,
	updateBackupById,
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
	keepLatestNBackups,
}));

vi.mock("@/server/core/utils/backups/utils", () => ({
	getS3Credentials: vi.fn(() => []),
	normalizeS3Path: vi.fn((value: string) => value),
	removeScheduleBackup,
	scheduleBackup,
}));

vi.mock("@/server/core/utils/backups/web-server", () => ({
	runWebServerBackup,
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

const makeCtx = (role: string, organizationId = "org-1") =>
	({
		session: { activeOrganizationId: organizationId, userId: `user-${role}` },
		user: { id: `user-${role}`, role },
		db: {},
		req: { headers: {} },
		res: { headers: new Headers() },
	}) as any;

const webServerCreateInput = {
	schedule: "0 0 * * *",
	enabled: false,
	prefix: "docklands",
	destinationId: "dest-1",
	keepLatestCount: 3,
	database: "docklands",
	databaseType: "web-server" as const,
	backupType: "database" as const,
};

const webServerUpdateInput = {
	backupId: "backup-web",
	schedule: "0 0 * * *",
	enabled: false,
	prefix: "docklands",
	destinationId: "dest-1",
	keepLatestCount: 3,
	database: "docklands",
	databaseType: "web-server" as const,
	serviceName: null,
	metadata: null,
};

const webServerBackup = {
	backupId: "backup-web",
	backupType: "database",
	databaseType: "web-server",
	destinationId: "dest-1",
	databaseId: null,
	serviceDatabaseId: null,
	composeId: null,
	enabled: false,
};

const databaseBackup = {
	backupId: "backup-db",
	backupType: "database",
	databaseType: "postgres",
	destinationId: "dest-1",
	databaseId: "db-1",
	serviceDatabaseId: null,
	composeId: null,
	enabled: false,
};

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
		createBackup.mockResolvedValue({ backupId: "backup-web" });
		findBackupById.mockResolvedValue(webServerBackup);
		removeBackupById.mockResolvedValue({ backupId: "backup-web" });
		updateBackupById.mockResolvedValue({ backupId: "backup-web" });
		findDatabaseById.mockResolvedValue({ databaseId: "db-1" });
		restoreDatabaseBackup.mockResolvedValue(undefined);
		restoreComposeBackup.mockResolvedValue(undefined);
		runWebServerBackup.mockResolvedValue(undefined);
		keepLatestNBackups.mockResolvedValue(undefined);
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

	it("requires owner or admin to create a whole-instance backup", async () => {
		const memberCaller = backupRouter.createCaller(makeCtx("member"));

		await expect(
			memberCaller.create(webServerCreateInput),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "Whole-instance backups require an owner or admin.",
		});

		expect(findDestinationById).not.toHaveBeenCalled();
		expect(createBackup).not.toHaveBeenCalled();
		expect(scheduleBackup).not.toHaveBeenCalled();
	});

	it("rejects whole-instance backup creation to a destination outside the active organization", async () => {
		findDestinationById.mockResolvedValue({
			destinationId: "dest-other",
			organizationId: "org-other",
		});

		await expect(caller.create(webServerCreateInput)).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "You don't have access to this destination.",
		});

		expect(createBackup).not.toHaveBeenCalled();
		expect(scheduleBackup).not.toHaveBeenCalled();
	});

	it("lets an owner create a whole-instance backup with an owned destination", async () => {
		const result = await caller.create(webServerCreateInput);

		expect(result).toEqual(webServerBackup);
		expect(findDestinationById).toHaveBeenCalledWith("dest-1");
		expect(createBackup).toHaveBeenCalledWith(webServerCreateInput);
		expect(scheduleBackup).not.toHaveBeenCalled();
		expect(audit).toHaveBeenCalledWith(ctx, {
			action: "create",
			resourceType: "backup",
			resourceId: "backup-web",
		});
	});

	it("rejects service-scoped ids on whole-instance backup creation", async () => {
		await expect(
			caller.create({
				...webServerCreateInput,
				databaseId: "db-1",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message:
				"Whole-instance backups must not be scoped to a service or database.",
		});

		expect(findDestinationById).not.toHaveBeenCalled();
		expect(createBackup).not.toHaveBeenCalled();
	});

	it("requires owner or admin to update a whole-instance backup", async () => {
		const memberCaller = backupRouter.createCaller(makeCtx("member"));

		await expect(
			memberCaller.update(webServerUpdateInput),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "Whole-instance backups require an owner or admin.",
		});

		expect(updateBackupById).not.toHaveBeenCalled();
		expect(removeScheduleBackup).not.toHaveBeenCalled();
	});

	it("rejects changing a service backup into a whole-instance backup", async () => {
		findBackupById.mockResolvedValue(databaseBackup);

		await expect(caller.update(webServerUpdateInput)).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "Service backups cannot be changed to whole-instance backups.",
		});

		expect(updateBackupById).not.toHaveBeenCalled();
	});

	it("requires owner or admin to run a whole-instance backup manually", async () => {
		const memberCaller = backupRouter.createCaller(makeCtx("member"));

		await expect(
			memberCaller.manualBackupWebServer({ backupId: "backup-web" }),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "Whole-instance backups require an owner or admin.",
		});

		expect(runWebServerBackup).not.toHaveBeenCalled();
		expect(keepLatestNBackups).not.toHaveBeenCalled();
	});

	it("runs a whole-instance backup manually only after destination access passes", async () => {
		const result = await caller.manualBackupWebServer({
			backupId: "backup-web",
		});

		expect(result).toBe(true);
		expect(findDestinationById).toHaveBeenCalledWith("dest-1");
		expect(runWebServerBackup).toHaveBeenCalledWith(webServerBackup);
		expect(keepLatestNBackups).toHaveBeenCalledWith(webServerBackup);
		expect(audit).toHaveBeenCalledWith(ctx, {
			action: "run",
			resourceType: "backup",
			resourceId: "backup-web",
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
