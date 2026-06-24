import { describe, expect, it } from "vitest";
import {
	isValidContainerId,
	isValidSearch,
	isValidShell,
	isValidSince,
	isValidTail,
} from "../../server/wss/utils";

/**
 * Additional hostile-input coverage for the WSS validators in
 * `server/wss/utils.ts`. These are command-injection boundaries: the validated
 * values are concatenated into `docker exec`/`docker logs` shell commands
 * (`docker-container-terminal.ts`, `docker-container-logs.ts`), so anything that
 * survives validation can reach a shell.
 *
 * Cases already asserted in `wss/utils.test.ts` are NOT repeated here — this file
 * only adds coverage that was thin or missing (notably `isValidShell`, which had
 * no test at all, and shell-metacharacter rejection in the id/search validators).
 */

// All the shell-injection metacharacters the validators exist to keep out.
const SHELL_METACHARS = [
	";",
	"|",
	"&",
	"$",
	"`",
	"(",
	")",
	"<",
	">",
	"\\",
	"\n",
	"\r",
	"\t",
	"'",
	'"',
	"*",
	"?",
	"{",
	"}",
	"[",
	"]",
	"!",
	"#",
	"~",
	" ",
];

describe("isValidShell (docker-container-terminal allowlist)", () => {
	it("accepts every allowlisted shell (bare + absolute form)", () => {
		for (const shell of [
			"sh",
			"bash",
			"zsh",
			"ash",
			"/bin/sh",
			"/bin/bash",
			"/bin/zsh",
			"/bin/ash",
		]) {
			expect(isValidShell(shell)).toBe(true);
		}
	});

	it("rejects shells that are not on the allowlist", () => {
		for (const shell of [
			"fish",
			"csh",
			"tcsh",
			"dash",
			"powershell.exe",
			"cmd",
			"/usr/bin/bash", // allowlist is exact-path; a different path is not allowed
			"/bin/sh ",
			"bash ",
			"",
			"BASH", // case-sensitive allowlist
			"Sh",
		]) {
			expect(isValidShell(shell)).toBe(false);
		}
	});

	it("rejects shell strings carrying injected commands", () => {
		for (const shell of [
			"sh; whoami",
			"bash -c 'id'",
			"sh -c id",
			"/bin/sh && id",
			"sh|id",
			"$(which sh)",
			"`sh`",
			"sh\nid",
		]) {
			expect(isValidShell(shell)).toBe(false);
		}
	});
});

describe("isValidContainerId (shell-metachar rejection)", () => {
	it("rejects every shell metacharacter appended to a valid-looking id", () => {
		for (const meta of SHELL_METACHARS) {
			// `meta` cannot be the leading char (the name pattern requires an
			// alphanumeric start), so anchor it after a benign prefix.
			expect(isValidContainerId(`web${meta}`)).toBe(false);
			expect(isValidContainerId(`web${meta}id`)).toBe(false);
		}
	});

	it("rejects subshell / backtick command substitution forms", () => {
		expect(isValidContainerId("$(id)")).toBe(false);
		expect(isValidContainerId("`id`")).toBe(false);
		expect(isValidContainerId("web$(reboot)")).toBe(false);
		expect(isValidContainerId("web`reboot`")).toBe(false);
		expect(isValidContainerId("$IFS")).toBe(false);
		expect(isValidContainerId("a&b")).toBe(false);
		expect(isValidContainerId("a)b")).toBe(false);
		expect(isValidContainerId("a(b")).toBe(false);
	});

	it("rejects empty, whitespace, and over-length ids", () => {
		expect(isValidContainerId("")).toBe(false);
		expect(isValidContainerId(" ")).toBe(false);
		expect(isValidContainerId("web app")).toBe(false);
		// Names are capped at 128 chars; a 129-char name (that isn't a hex id) is out.
		expect(isValidContainerId(`w${"a".repeat(128)}`)).toBe(false);
	});

	it("rejects names that start with a separator (must begin alphanumeric)", () => {
		expect(isValidContainerId("-web")).toBe(false);
		expect(isValidContainerId(".web")).toBe(false);
		expect(isValidContainerId("_web")).toBe(false);
	});

	it("still accepts a 128-char container name (boundary)", () => {
		expect(isValidContainerId(`w${"a".repeat(127)}`)).toBe(true);
	});
});

describe("isValidSearch (shell-metachar rejection)", () => {
	it("rejects every shell metacharacter (search is concatenated into a shell)", () => {
		// `isValidSearch` allows ` ` (space) only among separators, so exclude it.
		for (const meta of SHELL_METACHARS.filter((c) => c !== " ")) {
			expect(isValidSearch(`error${meta}`)).toBe(false);
		}
	});

	it("rejects glob, redirection, and brace expansion that the existing suite omits", () => {
		expect(isValidSearch("err*")).toBe(false);
		expect(isValidSearch("err?")).toBe(false);
		expect(isValidSearch("err > /tmp/x")).toBe(false);
		expect(isValidSearch("err < /etc/passwd")).toBe(false);
		expect(isValidSearch("{a,b}")).toBe(false);
		expect(isValidSearch("a\\b")).toBe(false);
		expect(isValidSearch("a~b")).toBe(false);
		expect(isValidSearch("a#b")).toBe(false);
	});
});

describe("isValidTail / isValidSince (boundary + injection)", () => {
	it("isValidTail rejects float/whitespace/sign forms not covered elsewhere", () => {
		expect(isValidTail("10.5")).toBe(false);
		expect(isValidTail(" 10")).toBe(false);
		expect(isValidTail("10 ")).toBe(false);
		expect(isValidTail("+10")).toBe(false);
		expect(isValidTail("0x10")).toBe(false);
	});

	it("isValidSince rejects mixed/duplicated unit and subshell forms", () => {
		expect(isValidSince("5sm")).toBe(false);
		expect(isValidSince("5s5s")).toBe(false);
		expect(isValidSince("ALL")).toBe(false);
		expect(isValidSince("all ")).toBe(false);
		expect(isValidSince("`date`")).toBe(false);
		expect(isValidSince("5s`id`")).toBe(false);
	});
});
