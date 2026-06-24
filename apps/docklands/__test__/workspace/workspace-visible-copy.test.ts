import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceSource = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("workspace visible product copy", () => {
	it("keeps workspace dialogs on Docklands product nouns", () => {
		const canvas = workspaceSource(
			"components/dashboard/workspace/environment-canvas.tsx",
		);
		const environmentSelector = workspaceSource(
			"components/dashboard/workspace/actions/advanced-environment-selector.tsx",
		);
		const addTemplate = workspaceSource(
			"components/dashboard/workspace/actions/add-template.tsx",
		);

		expect(canvas).toContain("Select a target workspace");
		expect(canvas).not.toContain("Select a target project");
		expect(environmentSelector).toContain(
			"Create a new environment for this workspace.",
		);
		expect(environmentSelector).not.toContain(
			"Create a new environment for your project.",
		);
		expect(addTemplate).toMatch(/add it to your\s+workspace\./);
		expect(addTemplate).not.toContain("add it to your project.");
	});

	it("teaches workspace variable references with the workspace namespace", () => {
		const canvas = workspaceSource(
			"components/dashboard/workspace/environment-canvas.tsx",
		);
		const workspaceVariables = workspaceSource(
			"components/dashboard/workspace/manage/workspace-variables.tsx",
		);

		expect(canvas).toContain("{{workspace.KEY}}");
		expect(canvas).not.toContain("{{project.KEY}}");
		expect(workspaceVariables).toContain("{{workspace.DATABASE_URL}}");
		expect(workspaceVariables).not.toContain("{{project.DATABASE_URL}}");
	});

	it("keeps settings and service forms on workspace/service nouns", () => {
		const serviceForms = [
			"components/dashboard/application/update-application.tsx",
			"components/dashboard/compose/update-compose.tsx",
			"components/dashboard/database-service/update-database.tsx",
		].map(workspaceSource);
		const tags = workspaceSource(
			"components/dashboard/settings/tags/tag-manager.tsx",
		);
		const tagDialog = workspaceSource(
			"components/dashboard/settings/tags/handle-tag.tsx",
		);
		const permissions = workspaceSource(
			"components/dashboard/settings/users/add-permissions.tsx",
		);
		const runtimeWorker = workspaceSource(
			"components/dashboard/settings/runtime/handle-runtime-worker.tsx",
		);
		const sshKeys = workspaceSource(
			"components/dashboard/settings/ssh-keys/handle-ssh-keys.tsx",
		);
		const clusterEmptyState = workspaceSource(
			"components/dashboard/cluster-runtime/containers/empty-states.tsx",
		);

		for (const form of serviceForms) {
			expect(form).toContain("Description for this service...");
			expect(form).not.toContain("Description about your workspace...");
		}

		for (const source of [
			tags,
			tagDialog,
			permissions,
			runtimeWorker,
			sshKeys,
			clusterEmptyState,
		]) {
			expect(source).not.toContain("organize your projects");
			expect(source).not.toContain("from all projects");
			expect(source).not.toContain("manage your projects");
			expect(source).not.toContain("which projects");
			expect(source).not.toContain("Personal projects");
			expect(source).not.toContain("Compose projects need");
			expect(source).not.toContain("project&apos;s build logs");
		}
	});
});
