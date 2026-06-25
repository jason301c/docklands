import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/server/core/constants/paths";
import {
	apiModifyTraefikConfig,
	apiReadTraefikConfig,
} from "@/server/core/db/schema/user";
import {
	normalizeTraefikConfigPath,
	TRAEFIK_CONFIG_PATH_ERROR,
} from "@/server/core/utils/traefik/path";

const execAsyncRemote = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote,
}));

const { readConfigInPath, writeTraefikConfigInPath } = await import(
	"@/server/core/utils/traefik/application"
);

const localRoot = () => paths().MAIN_TRAEFIK_PATH;
const remoteRoot = () => paths(true).MAIN_TRAEFIK_PATH;
const localConfigPath = () => `${localRoot()}/dynamic/app.yml`;
const remoteConfigPath = () => `${remoteRoot()}/dynamic/app.yml`;

describe("normalizeTraefikConfigPath", () => {
	it("accepts normalized absolute paths under the active Traefik root", () => {
		expect(normalizeTraefikConfigPath(localConfigPath())).toBe(
			localConfigPath(),
		);
		expect(normalizeTraefikConfigPath(remoteConfigPath(), "rw-1")).toBe(
			remoteConfigPath(),
		);
	});

	it.each([
		["relative path", "dynamic/app.yml"],
		["traversal", () => `${localRoot()}/dynamic/../secret.yml`],
		["prefix escape", () => `${localRoot()}-evil/dynamic/app.yml`],
		["shell semicolon", () => `${localRoot()}/dynamic/app.yml;touch`],
		["command substitution", () => `${localRoot()}/dynamic/$(touch-pwn).yml`],
		["control character", () => `${localRoot()}/dynamic/app.yml\nnext`],
		["current-directory segment", () => `${localRoot()}/dynamic/./app.yml`],
		["duplicate separator", () => `${localRoot()}/dynamic//app.yml`],
	])("rejects %s", (_label, pathOrFactory) => {
		const candidate =
			typeof pathOrFactory === "function" ? pathOrFactory() : pathOrFactory;

		expect(() => normalizeTraefikConfigPath(candidate)).toThrow(
			TRAEFIK_CONFIG_PATH_ERROR,
		);
	});
});

describe("Traefik config path schemas", () => {
	it("normalizes write inputs with the same path policy as read inputs", () => {
		const writeResult = apiModifyTraefikConfig.safeParse({
			path: localConfigPath(),
			traefikConfig: "http: {}\n",
		});
		const readResult = apiReadTraefikConfig.safeParse({
			path: localConfigPath(),
		});

		expect(writeResult.success).toBe(true);
		expect(readResult.success).toBe(true);
		if (writeResult.success)
			expect(writeResult.data.path).toBe(localConfigPath());
		if (readResult.success)
			expect(readResult.data.path).toBe(localConfigPath());
	});

	it("uses the remote Traefik root when a runtime worker is targeted", () => {
		const result = apiModifyTraefikConfig.safeParse({
			path: remoteConfigPath(),
			traefikConfig: "http: {}\n",
			runtimeWorkerId: "rw-1",
		});

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.path).toBe(remoteConfigPath());
	});

	it("rejects traversal and shell payloads for both read and write", () => {
		const traversal = `${localRoot()}/dynamic/../../outside.yml`;
		const shellPayload = `${localRoot()}/dynamic/app.yml$(touch-pwn)`;

		expect(apiReadTraefikConfig.safeParse({ path: traversal }).success).toBe(
			false,
		);
		expect(
			apiModifyTraefikConfig.safeParse({
				path: traversal,
				traefikConfig: "http: {}\n",
			}).success,
		).toBe(false);
		expect(apiReadTraefikConfig.safeParse({ path: shellPayload }).success).toBe(
			false,
		);
		expect(
			apiModifyTraefikConfig.safeParse({
				path: shellPayload,
				traefikConfig: "http: {}\n",
			}).success,
		).toBe(false);
	});
});

describe("Traefik config file utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		execAsyncRemote.mockResolvedValue({ stdout: "", stderr: "" });
	});

	it("rejects unsafe remote write paths before command execution", async () => {
		await expect(
			writeTraefikConfigInPath(
				`${remoteRoot()}/dynamic/app.yml;touch-pwn`,
				"http: {}\n",
				"rw-1",
			),
		).rejects.toThrow(TRAEFIK_CONFIG_PATH_ERROR);

		expect(execAsyncRemote).not.toHaveBeenCalled();
	});

	it("quotes the normalized path in remote read and write commands", async () => {
		execAsyncRemote.mockResolvedValueOnce({
			stdout: "http: {}\n",
			stderr: "",
		});

		await expect(readConfigInPath(remoteConfigPath(), "rw-1")).resolves.toBe(
			"http: {}\n",
		);
		await writeTraefikConfigInPath(remoteConfigPath(), "http: {}\n", "rw-1");

		expect(execAsyncRemote).toHaveBeenNthCalledWith(
			1,
			"rw-1",
			`cat ${remoteConfigPath()}`,
		);
		const writeCommand = execAsyncRemote.mock.calls[1]?.[1] as string;
		expect(writeCommand).toContain("printf '%s'");
		expect(writeCommand).toContain(` | base64 -d > ${remoteConfigPath()}`);
		expect(writeCommand).not.toContain("http: {}");
	});
});
