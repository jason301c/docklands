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

	it("ships the production setup entrypoint used by Docker installs", () => {
		const esbuildConfig = appFile("esbuild.config.ts");
		const productionDocs = repoFile(
			"apps/docs/src/content/docs/install/production.md",
		);

		expect(esbuildConfig).toContain(
			'"setup-instance": "server/ops/setup-instance.ts"',
		);
		expect(productionDocs).toContain("dist/setup-instance.mjs");
		expect(productionDocs).not.toContain("-p 80:80 -p 443:443");
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
		expect(rootPackage.scripts["docker:smoke:deploy"]).toBe(
			"./tools/docker/smoke-deploy.sh",
		);
		expect(workflow).toContain("load: true");
		expect(workflow).toContain("tags: docklands:ci-smoke");
		expect(workflow).toContain(
			"./tools/docker/smoke-image.sh docklands:ci-smoke",
		);
		expect(workflow).toContain(
			"./tools/docker/smoke-deploy.sh docklands:ci-smoke",
		);
		expect(smokeScript).toContain("/api/ready");
		expect(smokeScript).toContain("/api/auth/sign-up/email");
		expect(smokeScript).toContain("Admin is already created");
		expect(smokeScript).toContain("settings.updateDefaultIngressMode");
		expect(smokeScript).toContain("settings.getWebServerSettings");
		expect(smokeScript).toContain("workspaces.create");
		expect(smokeScript).toContain("application.saveDockerProvider");
		expect(smokeScript).toContain("domain.create");
		expect(smokeScript).toContain("application.deploy");
		expect(smokeScript).toContain("127.0.0.1:5000/docklands-smoke-app");
		expect(smokeScript).toContain("docklands.localhost");
		expect(smokeScript).toContain("/etc/docklands/traefik/dynamic");
		expect(smokeScript).toContain("docker service ps");
		expect(smokeScript).toContain("DOCKLANDS_DOCKER_HOST");
		expect(smokeScript).toContain("DOCKER_HOST");
		expect(smokeScript).toContain("docklands-network");
	});

	it("keeps Docker build and publish scripts release-tag safe", () => {
		const buildScript = repoFile("tools/docker/build.sh");
		const pushScript = repoFile("tools/docker/push.sh");

		expect(buildScript).toContain("validate_release_version");
		expect(pushScript).toContain("validate_release_version");
		expect(buildScript).toContain("^[0-9]+\\.[0-9]+\\.[0-9]+$");
		expect(pushScript).toContain("^[0-9]+\\.[0-9]+\\.[0-9]+$");
		expect(buildScript).not.toContain('TAG="${VERSION#v}"');
		expect(pushScript).not.toContain('TAG="${VERSION#v}"');
		expect(pushScript).toContain("DOCKLANDS_DOCKER_ALLOW_DIRTY");
		expect(pushScript).toContain("Tracked files are dirty");
		expect(pushScript).toContain("git diff --quiet");
		expect(buildScript).toContain("DOCKLANDS_DOCKER_DRY_RUN");
		expect(pushScript).toContain("DOCKLANDS_DOCKER_DRY_RUN");
		expect(buildScript).toContain("trap cleanup EXIT");
		expect(pushScript).toContain("trap cleanup EXIT");
		expect(buildScript).toContain('docker buildx rm "$BUILDER"');
		expect(pushScript).toContain('docker buildx rm "$BUILDER"');
		expect(pushScript).toContain('-t "${IMAGE_NAME}:latest"');
		expect(pushScript).toContain('-t "${IMAGE_NAME}:${TAG}"');
		expect(pushScript).toContain("--push");
	});

	it("keeps the manual real-deploy smoke self-cleaning", () => {
		const workflow = repoFile(".github/workflows/release-smoke.yml");
		const realDeployTest = appFile("__test__/deploy/application.real.test.ts");

		expect(realDeployTest).toContain("docker service rm ${appName}");
		expect(realDeployTest).toContain("for (const appName of allTestAppNames)");
		expect(workflow).toContain("docker service ls");
		expect(workflow).toContain("grep '^real-'");
	});

	it("dispatches both manual release smoke workflows for the same pushed ref", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const dispatchScript = repoFile(
			"tools/release/dispatch-smoke-workflows.sh",
		);

		expect(rootPackage.scripts["release:smoke:dispatch"]).toBe(
			"./tools/release/dispatch-smoke-workflows.sh",
		);
		expect(dispatchScript).toContain("gh workflow run release-smoke.yml");
		expect(dispatchScript).toContain("gh workflow run host-operator-smoke.yml");
		expect(dispatchScript).toContain('--ref "$git_ref"');
		expect(dispatchScript).toContain('-f "git_ref=$git_ref"');
		expect(dispatchScript).toContain('-f "git_url=$git_url"');
		expect(dispatchScript).toContain("git fetch --quiet");
		expect(dispatchScript).toContain("Push the branch before dispatching");
		expect(dispatchScript).toContain("DOCKLANDS_RELEASE_SMOKE_DRY_RUN");
		expect(dispatchScript).toContain("DOCKLANDS_RELEASE_SMOKE_ALLOW_DIRTY");
		expect(dispatchScript).toContain("--wait");
		expect(dispatchScript).toContain("DOCKLANDS_RELEASE_SMOKE_WAIT");
		expect(dispatchScript).toContain("workflow_run_ids");
		expect(dispatchScript).toContain("gh run list");
		expect(dispatchScript).toContain("gh run view");
		expect(dispatchScript).toContain('"workflow_dispatch"');
		expect(dispatchScript).toContain('"$target_sha"');
		expect(dispatchScript).toContain("Both release smoke workflows completed");
	});

	it("keeps the local release preflight aligned with required non-mutating gates", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const preflightScript = repoFile("tools/release/preflight.sh");

		expect(rootPackage.scripts["release:preflight"]).toBe(
			"./tools/release/preflight.sh",
		);
		expect(preflightScript).toContain(
			"bun install --frozen-lockfile --offline",
		);
		expect(preflightScript).toContain("bun run format-and-lint");
		expect(preflightScript).toContain("bun run typecheck");
		expect(preflightScript).toContain("bun run test:ci");
		expect(preflightScript).toContain("bun run check:baseui");
		expect(preflightScript).toContain("bun run check:openapi");
		expect(preflightScript).toContain("bun run build");
		expect(preflightScript).toContain("bun run docs:typecheck");
		expect(preflightScript).toContain("bun run docs:build");
		expect(preflightScript).toContain("bun run site:lint");
		expect(preflightScript).toContain("bun run site:typecheck");
		expect(preflightScript).toContain("bun run site:build");
		expect(preflightScript).toContain(
			"tools/docker/build.sh --dry-run production",
		);
		expect(preflightScript).toContain("tools/docker/push.sh");
		expect(preflightScript).toContain("--dry-run production");
		expect(preflightScript).toContain("DOCKLANDS_RELEASE_SMOKE_DRY_RUN=1");
		expect(preflightScript).toContain("DOCKLANDS_RELEASE_SMOKE_ALLOW_DIRTY");
		expect(preflightScript).toContain("dispatch-smoke-workflows.sh");
		expect(preflightScript).toContain("docker:smoke:deploy");
	});

	it("keeps the manual host-operator smoke wired to the image setup path", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const workflow = repoFile(".github/workflows/host-operator-smoke.yml");
		const smokeScript = repoFile("tools/release/host-operator-smoke.sh");

		expect(rootPackage.scripts["release:smoke:host"]).toBe(
			"./tools/release/host-operator-smoke.sh",
		);
		expect(workflow).toContain("docklands:host-smoke");
		expect(workflow).toContain(
			"postgres://docklands:docklands_smoke@docklands-postgres:5432/docklands",
		);
		expect(workflow).toContain("DOCKLANDS_HOST_SMOKE_BACKUP");
		expect(workflow).toContain("docklands-smoke-minio");
		expect(workflow).toContain("minio/minio:");
		expect(workflow).toContain("minio/mc:");
		expect(workflow).toContain("Replace Docklands container");
		expect(workflow).toContain("Run post-replacement upgrade smoke");
		expect(workflow).toContain("DOCKLANDS_HOST_SMOKE_EXISTING_OWNER");
		expect(workflow).toContain("dist/setup-instance.mjs");
		expect(workflow).toContain("--network docklands-network");
		expect(workflow).toContain("-p 127.0.0.1:3000:3000");
		expect(workflow).toContain("./tools/release/host-operator-smoke.sh");
		expect(workflow).toContain("docker rm -f docklands");
		expect(workflow).toContain("docker service rm docklands-postgres");
		expect(smokeScript).toContain("/api/ready");
		expect(smokeScript).toContain("/api/auth/sign-up/email");
		expect(smokeScript).toContain("/api/auth/sign-in/email");
		expect(smokeScript).toContain("settings.updateDefaultIngressMode");
		expect(smokeScript).toContain("application.saveDockerProvider");
		expect(smokeScript).toContain("domain.create");
		expect(smokeScript).toContain("application.deploy");
		expect(smokeScript).toContain("destination.create");
		expect(smokeScript).toContain("backup.create");
		expect(smokeScript).toContain("backup.manualBackupWebServer");
		expect(smokeScript).toContain("mc find");
		expect(smokeScript).toContain("Host: ${SMOKE_DEPLOY_HOST}");
		expect(smokeScript).toContain("TRAEFIK_URL");
		expect(smokeScript).toContain("/etc/docklands/traefik/dynamic");
		expect(smokeScript).toContain("docker service ps");
	});
});
