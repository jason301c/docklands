import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { apiCreateMount } from "@/server/core/db/schema";
import {
	createFile,
	getCreateFileCommand,
	getDeleteFileCommand,
	resolveFileMountPath,
} from "@/server/core/utils/docker/utils";

const baseCreateMountInput = {
	type: "file" as const,
	serviceType: "application" as const,
	serviceId: "app_1",
	mountPath: "/app/config.yml",
	content: "key: value",
};

describe("file mount path safety", () => {
	let tempDir: string | null = null;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
			tempDir = null;
		}
	});

	it("requires file mounts to use safe relative file paths", () => {
		for (const filePath of [
			undefined,
			"",
			"/etc/passwd",
			"../escape",
			"config/../../escape",
			"config//app.yml",
			"config\\app.yml",
			"config/app.yml;touch-pwn",
			"config/$(id).yml",
			"config/app name.yml",
		]) {
			const result = apiCreateMount.safeParse({
				...baseCreateMountInput,
				filePath,
			});

			expect(result.success, `expected ${String(filePath)} to fail`).toBe(
				false,
			);
		}

		expect(
			apiCreateMount.safeParse({
				...baseCreateMountInput,
				filePath: "config/app.yml",
			}).success,
		).toBe(true);
	});

	it("resolves file mount paths only under the service files directory", () => {
		const dir = mkdtempSync(join(tmpdir(), "docklands-mount-"));
		tempDir = dir;

		expect(resolveFileMountPath(dir, "config/app.yml")).toBe(
			join(dir, "config/app.yml"),
		);
		expect(() => resolveFileMountPath(dir, "../escape")).toThrow(
			"File mount paths must be relative",
		);
		expect(() => resolveFileMountPath(dir, "config/app.yml;touch")).toThrow(
			"File mount paths must be relative",
		);
	});

	it("writes local file mounts without escaping the base directory", async () => {
		const dir = mkdtempSync(join(tmpdir(), "docklands-mount-"));
		tempDir = dir;

		await createFile(dir, "config/app.yml", "safe: true");
		expect(readFileSync(join(dir, "config/app.yml"), "utf8")).toBe(
			"safe: true",
		);

		await expect(createFile(dir, "../../escape", "nope")).rejects.toThrow(
			"File mount paths must be relative",
		);
	});

	it("quotes remote file mount commands and rejects unsafe paths", () => {
		const dir = mkdtempSync(join(tmpdir(), "docklands-mount-"));
		tempDir = dir;

		const createCommand = getCreateFileCommand(
			dir,
			"config/app.yml",
			"safe: true",
		);
		const deleteCommand = getDeleteFileCommand(dir, "config/app.yml");

		expect(createCommand).toContain("printf %s");
		expect(createCommand).toContain("base64 -d");
		expect(deleteCommand).toContain("rm -rf --");
		expect(() =>
			getCreateFileCommand(dir, "config/app.yml;touch-pwn", "x"),
		).toThrow("File mount paths must be relative");
		expect(() => getDeleteFileCommand(dir, "../escape")).toThrow(
			"File mount paths must be relative",
		);
	});
});
