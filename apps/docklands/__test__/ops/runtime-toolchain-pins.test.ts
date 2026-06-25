import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("runtime toolchain pins", () => {
	it("pins production image tool versions and checks the installed binaries", () => {
		const dockerfile = sourceFile("Dockerfile");

		expect(dockerfile).toContain("ARG DOCKER_VERSION=28.5.2");
		expect(dockerfile).toContain("ARG RCLONE_VERSION=1.74.3");
		expect(dockerfile).toContain("ARG NIXPACKS_VERSION=1.41.0");
		expect(dockerfile).toContain("ARG RAILPACK_VERSION=0.15.4");
		expect(dockerfile).toContain("ARG BUILDPACKS_VERSION=0.39.1");
		expect(dockerfile).toContain(
			'docker --version | grep -F "$DOCKER_VERSION"',
		);
		expect(dockerfile).toContain(
			"https://downloads.rclone.org/v${RCLONE_VERSION}",
		);
		expect(dockerfile).toContain("sha256sum -c -");
		expect(dockerfile).toContain("rclone v${RCLONE_VERSION}");
		expect(dockerfile).toContain(
			'NIXPACKS_VERSION="$NIXPACKS_VERSION" ./install.sh --yes',
		);
		expect(dockerfile).toContain(
			'RAILPACK_VERSION="$RAILPACK_VERSION" ./install.sh --yes',
		);
		expect(dockerfile).toContain(
			'pack --version | grep -F "$BUILDPACKS_VERSION"',
		);
	});

	it("pins remote worker setup tools and fails on version mismatch", () => {
		const setup = sourceFile("server/core/setup/runtime-worker-setup.ts");

		expect(setup).toContain('docker: "28.5.0"');
		expect(setup).toContain('ubuntu2604Docker: "29.4.2"');
		expect(setup).toContain('rclone: "1.74.3"');
		expect(setup).toContain('nixpacks: "1.41.0"');
		expect(setup).toContain('railpack: "0.15.4"');
		expect(setup).toContain('buildpacks: "0.39.1"');
		expect(setup).toContain("https://downloads.rclone.org/v$RCLONE_VERSION");
		expect(setup).toContain("sha256sum -c -");
		expect(setup).not.toContain("curl https://rclone.org/install.sh");
		expect(setup).toContain("Docker version mismatch");
		expect(setup).toContain("RClone version mismatch");
		expect(setup).toContain("Nixpacks version mismatch");
		expect(setup).toContain("Railpack version mismatch");
		expect(setup).toContain("Buildpacks version mismatch");
	});
});
