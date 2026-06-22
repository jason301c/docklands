import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFile = (relativePath: string) =>
	readFileSync(
		fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
		"utf8",
	);

describe("domain DNS copy", () => {
	it("uses ingress address language in the DNS guide", () => {
		const source = sourceFile(
			"components/dashboard/application/domains/dns-helper-modal.tsx",
		);

		expect(source).toContain("Docklands");
		expect(source).toContain("ingress address");
		expect(source).toContain("Your ingress address");
		expect(source).toContain("Copy ingress address");
		expect(source).toContain("Ingress address copied");
		expect(source).not.toContain("server IP");
		expect(source).not.toContain("Your server IP");
		expect(source).not.toContain("Copy server IP");
	});
});
