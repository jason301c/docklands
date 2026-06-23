#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
/**
 * Static scanner for Kumo / Base UI composition pitfalls that only surface as
 * runtime dev warnings when a component actually renders (e.g. when you open a
 * dropdown, dialog, or select). Lets us catch them without clicking every menu.
 *
 * Kumo components are thin wrappers over Base UI, so the same structural rules
 * apply. The two recurring failure modes:
 *
 *  1. nativeButton mismatch — a Base UI `*.Trigger` whose `render` slot is a
 *     non-native-button element (DropdownMenu.Item, raw <div>/<span>/<a>, etc.)
 *     without an explicit `nativeButton={false}`. Base UI defaults triggers to
 *     nativeButton=true and warns when the rendered tag is not <button>.
 *
 *  2. GroupLabel-without-Group — a group-label part rendered outside its
 *     required group context. Base UI throws e.g. "MenuGroupContext is missing".
 *     This covers DropdownMenu.Label, Select.GroupLabel, Combobox.GroupLabel,
 *     and CommandPalette.GroupLabel.
 *
 * Usage: node tools/scan-baseui-pitfalls.mjs   (run from apps/docklands)
 * Exits non-zero if any issue is found.
 */

const root = process.cwd();
const files = execSync(
	`rg -l --glob '!**/node_modules/**' --glob '*.tsx' '\\.(Trigger|Label|GroupLabel)' ${root}`,
	{ encoding: "utf8" },
)
	.trim()
	.split("\n")
	.filter(Boolean);

// Components/tags that render a native <button>: a Trigger render slot using
// these is fine. Everything else needs nativeButton={false}.
const BUTTON_LIKE = /^(button|Button|SidebarMenuButton|SidebarMenuSubButton)\b/;

// Group-label parts that must be nested inside `<Owner.Group>`. The label part
// name differs per component (DropdownMenu uses `.Label`, the rest `.GroupLabel`).
const GROUP_LABEL_RULES = [
	{ owner: "DropdownMenu", label: "Label" },
	{ owner: "Select", label: "GroupLabel" },
	{ owner: "Combobox", label: "GroupLabel" },
	{ owner: "CommandPalette", label: "GroupLabel" },
];

const issues = [];
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

for (const file of files) {
	const src = readFileSync(file, "utf8");
	const rel = file.replace(`${root}/`, "");

	// --- Check 1: button-slot render rendering a non-button ------------------
	// Base UI Trigger/Close/SubTrigger parts default to nativeButton=true.
	const triggerRe =
		/<([A-Za-z][\w.]*)\.(Trigger|Close|SubTrigger)\b([^>]*?)\brender=\{\s*(?:\(\s*)?(?:\{[^}]*\}\s*=>\s*)?\(?\s*<([A-Za-z][\w.]*)/g;
	let m;
	while ((m = triggerRe.exec(src))) {
		const [, owner, part, attrs, rendered] = m;
		if (/\bnativeButton=\{?\s*false/.test(attrs)) continue;
		if (BUTTON_LIKE.test(rendered)) continue;
		issues.push(
			`${rel}:${lineOf(src, m.index)}  ${owner}.${part} renders <${rendered}> (not a <button>) — add nativeButton={false} or render a button`,
		);
	}

	// --- Check 2: group-label parts outside their Group ---------------------
	// Tokenize Group opens/closes (attribute-tolerant) and the label part, then
	// walk in source order tracking nesting depth. A label at depth 0 is orphaned.
	for (const { owner, label } of GROUP_LABEL_RULES) {
		const tokenRe = new RegExp(
			`<${owner}\\.Group(\\s[^>]*?)?(/?)>|</${owner}\\.Group>|<${owner}\\.${label}\\b`,
			"g",
		);
		let depth = 0;
		while ((m = tokenRe.exec(src))) {
			const tok = m[0];
			if (tok.startsWith(`</${owner}.Group`)) {
				depth = Math.max(0, depth - 1);
			} else if (tok.startsWith(`<${owner}.Group`)) {
				if (m[2] !== "/") depth++; // ignore self-closing <Group/>
			} else if (depth === 0) {
				issues.push(
					`${rel}:${lineOf(src, m.index)}  ${owner}.${label} is not inside a ${owner}.Group (Base UI group-context error)`,
				);
			}
		}
	}
}

if (issues.length === 0) {
	console.log("✓ No Kumo/Base UI composition pitfalls found.");
	process.exit(0);
}
console.error(`✗ Found ${issues.length} Kumo/Base UI composition issue(s):\n`);
for (const i of issues) console.error(`  ${i}`);
process.exit(1);
