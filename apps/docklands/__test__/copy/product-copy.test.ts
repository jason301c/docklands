import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("Docklands product copy", () => {
	it("keeps runtime worker UI and setup copy out of inherited runtimeWorker wording", () => {
		const files = [
			"components/dashboard/impersonation/impersonation-bar.tsx",
			"components/dashboard/settings/image-registry/handle-image-registry.tsx",
			"components/dashboard/settings/storage/handle-storage-provider.tsx",
			"components/dashboard/settings/ssh-keys/show-ssh-keys.tsx",
			"components/dashboard/settings/notifications/handle-notifications.tsx",
			"app/(onboarding)/register/_client.tsx",
			"server/core/setup/runtime-worker-setup.ts",
		].map(sourceFile);

		for (const source of files) {
			expect(source).not.toContain("Servers:");
			expect(source).not.toContain("Please select a runtimeWorker");
			expect(source).not.toContain("access your servers");
			expect(source).not.toContain("Setup the runtimeWorker");
			expect(source).not.toContain("setup the runtimeWorker");
			expect(source).not.toContain("Setup Server");
			expect(source).not.toContain("Server Dependencies");
			expect(source).not.toContain("Server Type");
			expect(source).not.toContain("Server Name");
			expect(source).not.toContain("Server Monitoring Alert");
			expect(source).not.toContain("runtimeWorker threshold");
		}
	});

	it("keeps service API errors on workspace and runtime-worker nouns", () => {
		const routers = [
			"server/api/routers/application.ts",
			"server/api/routers/compose.ts",
			"server/api/routers/database.ts",
			"server/api/routers/runtime-worker.ts",
			"server/api/routers/backup.ts",
			"server/api/routers/settings.ts",
			"server/api/routers/workspace.ts",
			"server/api/routers/tag.ts",
		].map(sourceFile);

		for (const source of routers) {
			expect(source).not.toContain("You need to use a server to create");
			expect(source).not.toContain(
				"You are not authorized to access this project",
			);
			expect(source).not.toContain(
				"You are not authorized to access this server",
			);
			expect(source).not.toContain(
				"You are not authorized to access this build server",
			);
			expect(source).not.toContain("Server is inactive");
			expect(source).not.toContain("Error creating the server");
			expect(source).not.toContain("Error creating the project");
			expect(source).not.toContain("Project not found");
			expect(source).not.toContain("assigned to this project");
			expect(source).not.toContain("tag from project");
		}
	});

	it("keeps notification labels on workspace and container-runtime nouns", () => {
		const notificationFiles = [
			"server/core/emails/emails/build-success.tsx",
			"server/core/emails/emails/build-failed.tsx",
			"server/core/emails/emails/database-backup.tsx",
			"server/core/emails/emails/volume-backup.tsx",
			"server/core/emails/emails/docker-cleanup.tsx",
			"server/core/utils/notifications/build-success.ts",
			"server/core/utils/notifications/build-error.ts",
			"server/core/utils/notifications/database-backup.ts",
			"server/core/utils/notifications/volume-backup.ts",
			"server/core/utils/notifications/docker-cleanup.ts",
		].map(sourceFile);

		for (const source of notificationFiles) {
			expect(source).not.toContain("Project Name:");
			expect(source).not.toContain("Project: ");
			expect(source).not.toContain("**Project:**");
			expect(source).not.toContain("<b>Project:</b>");
			expect(source).not.toContain("Docker Cleanup");
			expect(source).not.toContain("Docker cleanup");
			expect(source).not.toContain("docker cleanup");
		}
	});
});
