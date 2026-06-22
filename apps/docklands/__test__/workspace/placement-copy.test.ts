import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const actionFiles = [
	"add-application.tsx",
	"add-compose.tsx",
	"add-database.tsx",
	"add-import.tsx",
	"add-template.tsx",
];

const actionSource = (file: string) =>
	readFileSync(
		fileURLToPath(
			new URL(
				`../../components/dashboard/workspace/actions/${file}`,
				import.meta.url,
			),
		),
		"utf8",
	);

describe("workspace placement copy", () => {
	it("uses one shared placement selector across create-service flows", () => {
		for (const file of actionFiles) {
			const source = actionSource(file);

			expect(source).toContain('from "./placement-select"');
			expect(source).not.toContain("Runtime workers (");
			expect(source).not.toContain("<Select.GroupLabel>");
			expect(source).not.toContain('<Select.Option value="docklands">');
		}
	});
});
