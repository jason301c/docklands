import { describe, expect, it } from "vitest";
import {
	getDatabaseBackupType,
	getVolumeBackupType,
} from "@/components/dashboard/workspace/canvas/service-classification";
import type { WorkspaceServiceType } from "@/shared/workspace-graph";

const service = (type: WorkspaceServiceType) => ({
	id: `${type}-1`,
	name: type,
	type,
});

describe("workspace service backup classification", () => {
	it("exposes logical backup actions only for engines with dump commands", () => {
		expect(getDatabaseBackupType(service("postgres"))).toBe("postgres");
		expect(getDatabaseBackupType(service("mysql"))).toBe("mysql");
		expect(getDatabaseBackupType(service("mariadb"))).toBe("mariadb");
		expect(getDatabaseBackupType(service("mongo"))).toBe("mongo");
		expect(getDatabaseBackupType(service("redis"))).toBeUndefined();
		expect(getDatabaseBackupType(service("libsql"))).toBeUndefined();
	});

	it("exposes volume backup actions for apps, stacks, and volume-only engines", () => {
		expect(getVolumeBackupType(service("application"))).toBe("application");
		expect(getVolumeBackupType(service("compose"))).toBe("compose");
		expect(getVolumeBackupType(service("redis"))).toBe("redis");
		expect(getVolumeBackupType(service("libsql"))).toBe("libsql");
		expect(getVolumeBackupType(service("postgres"))).toBeUndefined();
		expect(getVolumeBackupType(service("mysql"))).toBeUndefined();
		expect(getVolumeBackupType(service("mariadb"))).toBeUndefined();
		expect(getVolumeBackupType(service("mongo"))).toBeUndefined();
	});
});
