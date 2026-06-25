import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

const repoFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("production Dockerfile release install", () => {
	it("keeps Bun dependency stages aligned with the workspace lockfile", () => {
		const dockerfile = appFile("Dockerfile");

		expect(dockerfile).toContain(
			"COPY apps/docklands/package.json ./apps/docklands/package.json",
		);
		expect(dockerfile).toContain(
			"COPY apps/docs/package.json ./apps/docs/package.json",
		);
		expect(dockerfile).toContain(
			"COPY apps/site/package.json ./apps/site/package.json",
		);
		expect(dockerfile).toContain(
			"bun install --filter docklands --frozen-lockfile",
		);
		expect(dockerfile).toContain(
			"bun install --filter docklands --frozen-lockfile --production",
		);
	});

	it("does not make non-git Docker dependency stages fail during prepare", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));

		expect(rootPackage.scripts.prepare).toBe(
			"if git rev-parse --git-dir >/dev/null 2>&1; then git config core.hooksPath .githooks; fi",
		);
	});

	it("does not leak rclone-prefixed build arguments into rclone commands", () => {
		const dockerfile = appFile("Dockerfile");

		expect(dockerfile).toContain("ARG FILE_SYNC_RELEASE=1.74.3");
		expect(dockerfile).not.toMatch(/^(ARG|ENV) RCLONE_/m);
	});

	it("does not bake build-only auth placeholders into Dockerfile environment", () => {
		const dockerfile = appFile("Dockerfile");

		expect(dockerfile).not.toContain("BETTER_AUTH_SECRET");
	});

	it("runs the loaded production image through the first-run smoke gate", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const workflow = repoFile(".github/workflows/docker-build.yml");
		const smokeScript = repoFile("tools/docker/smoke-image.sh");

		expect(rootPackage.scripts["docker:smoke"]).toBe(
			"./tools/docker/smoke-image.sh",
		);
		expect(rootPackage.scripts["docker:smoke:operator"]).toBe(
			"./tools/docker/smoke-operator.sh",
		);
		expect(workflow).toContain("load: true");
		expect(workflow).toContain("tags: docklands:ci-smoke");
		expect(workflow).toContain(
			"./tools/docker/smoke-image.sh docklands:ci-smoke",
		);
		expect(workflow).toContain(
			"./tools/docker/smoke-operator.sh docklands:ci-smoke",
		);
		expect(smokeScript).toContain("/api/ready");
		expect(smokeScript).toContain("/api/auth/sign-up/email");
		expect(smokeScript).toContain("Admin is already created");
		expect(smokeScript).toContain("DOCKLANDS_DOCKER_HOST");
		expect(smokeScript).toContain("docklands-network");
	});
});
