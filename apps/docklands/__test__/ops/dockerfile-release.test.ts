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

	it("exposes exactly two dev modes and drops the laptop install footguns", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const appPackage = JSON.parse(appFile("package.json"));

		// Local mode: one self-healing command (ensure Postgres -> migrate -> run).
		expect(appPackage.scripts.dev).toContain(
			"server/ops/ensure-postgres-dev.ts",
		);
		expect(appPackage.scripts.dev).toContain("bun run migration:run");
		expect(appFile("server/ops/ensure-postgres-dev.ts")).toContain(
			"docklands-dev-postgres",
		);

		// Faithful dev: dev:host runs the real Swarm/Traefik setup before the
		// hot-reloading dev server, and refuses to run on macOS (the host-Docker
		// footgun) so it only mutates a replica VM / disposable Linux host.
		expect(appPackage.scripts["dev:host"]).toContain(
			"server/ops/setup-instance.ts",
		);
		expect(appPackage.scripts["dev:host"]).toContain(
			"SKIP_BUNDLED_POSTGRES=true",
		);
		expect(appPackage.scripts["dev:host"]).toContain(
			"process.platform==='linux'",
		);
		expect(rootPackage.scripts["dev:host"]).toBe(
			"bun --filter docklands --elide-lines=0 dev:host",
		);

		// The laptop install footguns are gone — `setup` survives only as the
		// image entrypoint (dist/setup-instance.mjs), never as a human command.
		expect(rootPackage.scripts.setup).toBeUndefined();
		expect(appPackage.scripts.setup).toBeUndefined();
		expect(rootPackage.scripts["db:push"]).toBeUndefined();
		expect(appPackage.scripts["db:push"]).toBeUndefined();
		expect(rootPackage.scripts["migration:up"]).toBeUndefined();
		expect(rootPackage.scripts["migration:drop"]).toBeUndefined();
	});

	it("ships the replica blueprint behind the replica:* commands", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const limaTemplate = repoFile("tools/replica/lima.yaml");
		const replicaScript = repoFile("tools/replica/replica.sh");

		expect(rootPackage.scripts["replica:up"]).toBe(
			"./tools/replica/replica.sh up",
		);
		expect(rootPackage.scripts["replica:reset"]).toBe(
			"./tools/replica/replica.sh reset",
		);
		expect(rootPackage.scripts["replica:down"]).toBe(
			"./tools/replica/replica.sh down",
		);
		expect(limaTemplate).toContain("__REPO_ROOT__");
		expect(limaTemplate).toContain("docker");
		expect(replicaScript).toContain("limactl");
	});

	it("ships a one-line installer for end users (Linux host + macOS via Lima)", () => {
		const installer = repoFile("install.sh");

		// One command, two branches: a real Linux host install, and a macOS path
		// that boots a Lima VM and re-runs the same install inside it.
		expect(installer).toContain("linux_main");
		expect(installer).toContain("darwin_main");
		// Linux branch installs Docker if missing and reuses the tested setup
		// entrypoint rather than reimplementing Swarm/Traefik in shell.
		expect(installer).toContain("https://get.docker.com");
		expect(installer).toContain("dist/setup-instance.mjs");
		// macOS branch drives Lima and re-invokes itself in the VM.
		expect(installer).toContain("limactl");
		expect(installer).toContain("DOCKLANDS_INSTALL_URL");
		// Install and upgrade share one code path.
		expect(installer).toContain("install | update");
		// Secrets are generated on the box (kernel CSPRNG, no openssl dependency,
		// no password baked into the repo).
		expect(installer).toContain("/dev/urandom");
		expect(installer).toContain("DOCKLANDS_ENCRYPTION_KEY=");
	});

	it("publishes multi-arch images automatically from CI", () => {
		const release = repoFile(".github/workflows/release.yml");

		// Per-arch native runners (no QEMU emulation) + digest merge — the
		// Dokploy/Coolify publish pattern, so the laptop never builds release images.
		expect(release).toContain("ubuntu-24.04-arm");
		expect(release).toContain("platform: linux/amd64");
		expect(release).toContain("platform: linux/arm64");
		expect(release).toContain("push-by-digest=true");
		expect(release).toContain("docker buildx imagetools create");
		// Triggered by canary pushes and semver tags; tags resolved by metadata-action.
		expect(release).toContain("branches: [canary]");
		expect(release).toContain('tags: ["[0-9]*.[0-9]*.[0-9]*"]');
		expect(release).toContain("docker/metadata-action");
		expect(release).toContain("IMAGE_NAME: jason301c/docklands");
	});

	it("verifies the production image through one verify harness", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const workflow = repoFile(".github/workflows/verify.yml");
		const verifyScript = repoFile("tools/verify/verify.sh");
		const verifyLib = repoFile("tools/verify/lib.sh");

		expect(rootPackage.scripts.verify).toBe("./tools/verify/verify.sh all");
		expect(rootPackage.scripts["verify:install"]).toBe(
			"./tools/verify/verify.sh install",
		);
		expect(rootPackage.scripts["verify:deploy"]).toBe(
			"./tools/verify/verify.sh deploy",
		);
		expect(rootPackage.scripts["verify:upgrade"]).toBe(
			"./tools/verify/verify.sh upgrade",
		);
		expect(rootPackage.scripts["verify:backup"]).toBe(
			"./tools/verify/verify.sh backup",
		);
		expect(rootPackage.scripts["verify:worker"]).toBe(
			"./tools/verify/verify.sh worker",
		);

		// The old smoke zoo is gone.
		expect(rootPackage.scripts["docker:smoke"]).toBeUndefined();
		expect(rootPackage.scripts["docker:smoke:operator"]).toBeUndefined();
		expect(rootPackage.scripts["docker:smoke:deploy"]).toBeUndefined();
		expect(rootPackage.scripts["release:smoke:host"]).toBeUndefined();
		expect(rootPackage.scripts["release:smoke:dispatch"]).toBeUndefined();

		// CI builds the image and runs the same verify verbs a developer runs.
		expect(workflow).toContain("load: true");
		expect(workflow).toContain("tags: docklands:ci-verify");
		expect(workflow).toContain(
			"./tools/verify/verify.sh deploy --image docklands:ci-verify",
		);
		expect(workflow).toContain(
			"./tools/verify/verify.sh all --image docklands:ci-verify",
		);
		// The Git + Nixpacks real deploy stays covered.
		expect(workflow).toContain("application.real.test.ts");
		expect(workflow).toContain("docker service ls");
		expect(workflow).toContain("grep '^real-'");

		// The proven assertions live in the verify library + orchestrator.
		expect(verifyLib).toContain("/api/ready");
		expect(verifyLib).toContain("/api/auth/sign-up/email");
		expect(verifyLib).toContain("/api/auth/sign-in/email");
		expect(verifyLib).toContain("Admin is already created");
		expect(verifyLib).toContain("settings.updateDefaultIngressMode");
		expect(verifyLib).toContain("settings.getWebServerSettings");
		expect(verifyLib).toContain("workspaces.create");
		expect(verifyLib).toContain("application.saveDockerProvider");
		expect(verifyLib).toContain("domain.create");
		expect(verifyLib).toContain("application.deploy");
		expect(verifyLib).toContain("destination.create");
		expect(verifyLib).toContain("backup.create");
		expect(verifyLib).toContain("backup.manualBackupWebServer");
		expect(verifyLib).toContain("docklands-network");
		expect(verifyLib).toContain("docklands.localhost");
		expect(verifyScript).toContain("DOCKLANDS_DOCKER_HOST");
		expect(verifyScript).toContain("mc find");
		expect(verifyScript).toContain("/etc/docklands/traefik/dynamic");
	});

	it("keeps Docker build and publish scripts release-tag safe", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const buildScript = repoFile("tools/docker/build.sh");
		const pushScript = repoFile("tools/docker/push.sh");
		const dockerIgnore = repoFile(".dockerignore");
		const gitIgnore = repoFile(".gitignore");

		expect(rootPackage.scripts["release:image"]).toBe(
			"./tools/docker/build.sh",
		);
		expect(rootPackage.scripts["release:publish"]).toBe(
			"./tools/docker/push.sh",
		);
		expect(buildScript).toContain("validate_release_version");
		expect(pushScript).toContain("validate_release_version");
		expect(dockerIgnore).toContain(".claude");
		expect(gitIgnore).toContain(".claude/");
		expect(buildScript).toContain("^[0-9]+\\.[0-9]+\\.[0-9]+$");
		expect(pushScript).toContain("^[0-9]+\\.[0-9]+\\.[0-9]+$");
		expect(buildScript).not.toContain('TAG="${VERSION#v}"');
		expect(pushScript).not.toContain('TAG="${VERSION#v}"');
		expect(pushScript).toContain("DOCKLANDS_DOCKER_ALLOW_DIRTY");
		expect(pushScript).toContain("DOCKLANDS_DOCKER_REMOTE");
		expect(pushScript).toContain("DOCKLANDS_DOCKER_SKIP_RELEASE_TAG_CHECK");
		expect(pushScript).toContain("Tracked files are dirty");
		expect(pushScript).toContain("git diff --quiet");
		expect(pushScript).toContain("git ls-files --others --exclude-standard");
		expect(pushScript).toContain("Untracked files are present");
		expect(buildScript).toContain("DOCKLANDS_DOCKER_DRY_RUN");
		expect(pushScript).toContain("DOCKLANDS_DOCKER_DRY_RUN");
		expect(pushScript).toContain(
			"--skip-release-tag-check is only allowed with --dry-run",
		);
		expect(pushScript).toContain("verify_release_tag");
		expect(pushScript).toContain("refs/tags/$release_tag");
		expect(pushScript).toContain("refs/tags/$release_tag^{}");
		expect(pushScript).toContain("git ls-remote");
		expect(pushScript).toContain(
			"Run 'bun run release:tag --push <ref>' before publishing Docker images.",
		);
		expect(pushScript).toContain(
			"Release tag '$release_tag' does not point at the current commit.",
		);
		expect(buildScript).toContain("trap cleanup EXIT");
		expect(pushScript).toContain("trap cleanup EXIT");
		expect(buildScript).toContain('docker buildx rm "$BUILDER"');
		expect(pushScript).toContain('docker buildx rm "$BUILDER"');
		expect(buildScript).toContain("linux/amd64,linux/arm64");
		expect(pushScript).toContain("linux/amd64,linux/arm64");
		expect(pushScript).toContain('-t "${IMAGE_NAME}:latest"');
		expect(pushScript).toContain('-t "${IMAGE_NAME}:${TAG}"');
		expect(pushScript).toContain("--push");
	});

	it("keeps release metadata aligned across deployable packages", () => {
		const docklandsPackage = JSON.parse(appFile("package.json"));
		const docsPackage = JSON.parse(repoFile("apps/docs/package.json"));
		const sitePackage = JSON.parse(repoFile("apps/site/package.json"));
		const metadataCheck = repoFile("tools/release/check-metadata.mjs");
		const preflightScript = repoFile("tools/release/preflight.sh");

		expect(docsPackage.version).toBe(docklandsPackage.version);
		expect(sitePackage.version).toBe(docklandsPackage.version);
		expect(metadataCheck).toContain("apps/docklands/package.json");
		expect(metadataCheck).toContain("apps/docs/package.json");
		expect(metadataCheck).toContain("apps/site/package.json");
		expect(metadataCheck).toContain("bun.lock");
		// check-metadata is folded into preflight (and tag-release) directly.
		expect(preflightScript).toContain("node tools/release/check-metadata.mjs");
	});

	it("keeps release tagging guarded and package-version derived", () => {
		const rootPackage = JSON.parse(repoFile("package.json"));
		const tagScript = repoFile("tools/release/tag-release.sh");
		const preflightScript = repoFile("tools/release/preflight.sh");

		expect(rootPackage.scripts["release:tag"]).toBe(
			"./tools/release/tag-release.sh",
		);
		expect(tagScript).toContain("apps/docklands/package.json");
		expect(tagScript).toContain("node tools/release/check-metadata.mjs");
		expect(tagScript).toContain("Release tag version must be plain semver");
		expect(tagScript).toContain("Tracked files are dirty");
		expect(tagScript).toContain("Push the branch before tagging the release");
		expect(tagScript).toContain("git tag -a");
		expect(tagScript).toContain("refs/tags/$tag_name");
		expect(tagScript).toContain("git push");
		expect(tagScript).toContain("--dry-run");
		expect(tagScript).toContain("--skip-fetch");
		expect(preflightScript).toContain(
			"tag_dry_run_args=(--dry-run --skip-fetch)",
		);
		expect(preflightScript).toContain(
			'tag_dry_run_args=(--allow-dirty "${tag_dry_run_args[@]}")',
		);
		expect(preflightScript).toContain(
			'tools/release/tag-release.sh "${tag_dry_run_args[@]}" "$git_ref"',
		);
	});

	it("keeps v0.1.0 release notes honest about gates and boundaries", () => {
		const releaseNotes = repoFile("docs/RELEASE_NOTES.md");
		const docsCurrentCheck = repoFile("tools/check-docs-current.mjs");

		expect(docsCurrentCheck).toContain("docs/RELEASE_NOTES.md");
		expect(releaseNotes).toContain("# Docklands v0.1.0 Release Notes");
		expect(releaseNotes).toContain("bun run release:preflight canary");
		expect(releaseNotes).toContain("bun run verify");
		expect(releaseNotes).toContain("bun run release:tag --push canary");
		expect(releaseNotes).toContain("bun run release:publish");
		expect(releaseNotes).toContain("jason301c/docklands:0.1.0");
		expect(releaseNotes).toContain("There is exactly one organization");
		expect(releaseNotes).toContain("GitHub is the only provider");
		expect(releaseNotes).toContain("External Postgres disaster recovery");
		expect(releaseNotes).toContain("same-image container replacement");
		expect(releaseNotes).toContain("one-line installer");
		expect(releaseNotes).toContain("install.sh");
	});

	it("keeps production operator docs aligned with the standalone install path", () => {
		const productionDocs = repoFile(
			"apps/docs/src/content/docs/install/production.md",
		);
		const configurationDocs = repoFile(
			"apps/docs/src/content/docs/install/configuration.md",
		);
		const operationsDocs = repoFile(
			"apps/docs/src/content/docs/install/operations.md",
		);
		const ingressDocs = repoFile(
			"apps/docs/src/content/docs/networking/ingress.md",
		);
		const architectureDocs = repoFile(
			"apps/docs/src/content/docs/concepts/architecture.md",
		);
		const serverSettingsDocs = repoFile(
			"apps/docs/src/content/docs/settings/server-settings.md",
		);
		const settingsRouter = appFile("server/api/routers/settings.ts");

		expect(productionDocs).toContain('docker pull "$DOCKLANDS_IMAGE"');
		expect(productionDocs).toContain("docker build --pull -t docklands:local");
		expect(productionDocs).toContain('"$DOCKLANDS_IMAGE"');
		expect(productionDocs).toContain(
			"bun run wait-for-postgres && exec bun run start",
		);
		expect(configurationDocs).toContain("POSTGRES_HOST");
		expect(configurationDocs).toContain("POSTGRES_PORT");
		expect(configurationDocs).not.toContain("SMTP_SERVER");
		expect(configurationDocs).toContain("Settings → Notifications");
		expect(operationsDocs).toContain("RESTORE_DOCKLANDS_INSTANCE");
		expect(operationsDocs).toContain("rotate-encryption-key");
		expect(ingressDocs).toContain("docklands-traefik` standalone container");
		expect(architectureDocs).toContain(
			"standalone container joined to `docklands-network`",
		);
		expect(serverSettingsDocs).toContain(
			"recreate the container with the same mounts, network, and environment",
		);
		expect(settingsRouter).toContain(
			'reloadDockerResource("docklands", undefined, data.latestVersion)',
		);
		expect(settingsRouter).not.toContain("docker service update");
	});

	it("keeps the real-deploy verify self-cleaning", () => {
		const workflow = repoFile(".github/workflows/verify.yml");
		const realDeployTest = appFile("__test__/deploy/application.real.test.ts");

		expect(realDeployTest).toContain("docker service rm ${appName}");
		expect(realDeployTest).toContain("for (const appName of allTestAppNames)");
		expect(workflow).toContain("docker service ls");
		expect(workflow).toContain("grep '^real-'");
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
		expect(preflightScript).toContain("node tools/release/check-metadata.mjs");
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
		expect(preflightScript).toContain(
			"--dry-run --skip-release-tag-check production",
		);
		expect(preflightScript).toContain("bun run verify:deploy");
	});
});
