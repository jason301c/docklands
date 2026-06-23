#!/usr/bin/env node
import { execSync } from "node:child_process";
/**
 * Static scanner for the Base UI composition pitfalls that only surface as
 * runtime dev warnings when a component actually renders (e.g. when you open a
 * dropdown or dialog). Lets us catch them without clicking every button.
 *
 * Checks:
 *  1. nativeButton mismatch — a Base UI `*.Trigger` whose `render` slot is a
 *     non-native-button element (DropdownMenu.Item, *.Item, raw <div>/<span>/<a>,
 *     etc.) without an explicit `nativeButton={false}`. Base UI defaults
 *     triggers to nativeButton=true and warns when the rendered tag is not
 *     <button>.
 *  2. GroupLabel-without-Group — `DropdownMenu.Label` (Base UI Menu.GroupLabel)
 *     that is not nested inside a `DropdownMenu.Group`.
 *
 * Usage: node tools/scan-baseui-pitfalls.mjs   (run from apps/docklands)
 * Exits non-zero if any issue is found.
 */
import { readFileSync } from "node:fs";

const root = process.cwd();
const files = execSync(
	`rg -l --glob '!**/node_modules/**' --glob '*.tsx' '\\.(Trigger|Label)' ${root}`,
	{ encoding: "utf8" },
)
	.trim()
	.split("\n")
	.filter(Boolean);

// Components/tags that render a native <button>: a Trigger render slot using
// these is fine. Everything else needs nativeButton={false}.
const BUTTON_LIKE = /^(button|Button|SidebarMenuButton|SidebarMenuSubButton)\b/;

const issues = [];

for (const file of files) {
	const src = readFileSync(file, "utf8");
	const rel = file.replace(`${root}/`, "");

	// --- Check 1: Trigger render slot rendering a non-button -----------------
	// Match `<Something.Trigger ...>` up to the `render={` and capture whether
	// nativeButton is set, plus the first JSX tag inside the render slot.
	const triggerRe =
		/<([A-Za-z][\w.]*)\.Trigger\b([^>]*?)\brender=\{\s*(?:\(\s*)?(?:\{[^}]*\}\s*=>\s*)?\(?\s*<([A-Za-z][\w.]*)/g;
	let m;
	while ((m = triggerRe.exec(src))) {
		const [, owner, attrs, rendered] = m;
		if (/\bnativeButton=\{?\s*false/.test(attrs)) continue;
		if (BUTTON_LIKE.test(rendered)) continue;
		const line = src.slice(0, m.index).split("\n").length;
		issues.push(
			`${rel}:${line}  ${owner}.Trigger renders <${rendered}> (not a <button>) — add nativeButton={false} or render a button`,
		);
	}

	// --- Check 2: DropdownMenu.Label outside DropdownMenu.Group --------------
	const labelRe = /<DropdownMenu\.Label\b/g;
	while ((m = labelRe.exec(src))) {
		const before = src.slice(0, m.index);
		const open = before.lastIndexOf("<DropdownMenu.Group>");
		const close = before.lastIndexOf("</DropdownMenu.Group>");
		if (open <= close) {
			const line = before.split("\n").length;
			issues.push(
				`${rel}:${line}  DropdownMenu.Label is not inside a DropdownMenu.Group (Base UI MenuGroupContext error)`,
			);
		}
	}
}

if (issues.length === 0) {
	console.log("✓ No Base UI composition pitfalls found.");
	process.exit(0);
}
console.error(`✗ Found ${issues.length} Base UI composition issue(s):\n`);
for (const i of issues) console.error("  " + i);
process.exit(1);
