import path, { join } from "node:path";
import { quote } from "shell-quote";
import { paths } from "@/server/core/constants/paths";
import { createLogger } from "@/server/core/lib/logger";
import {
	findSSHKeyById,
	updateSSHKeyById,
} from "@/server/core/services/ssh-key";
import { execAsync, execAsyncRemote } from "../process/execAsync";

const logger = createLogger("git-provider");

interface CloneGitRepository {
	appName: string;
	customGitUrl?: string | null;
	customGitBranch?: string | null;
	customGitSSHKeyId?: string | null;
	enableSubmodules?: boolean;
	runtimeWorkerId: string | null;
	type?: "application" | "compose";
	outputPathOverride?: string;
}

export const cloneGitRepository = async ({
	type = "application",
	...entity
}: CloneGitRepository) => {
	let command = "set -e;";
	const {
		appName,
		customGitUrl,
		customGitBranch,
		customGitSSHKeyId,
		enableSubmodules,
		runtimeWorkerId,
		outputPathOverride,
	} = entity;
	const { SSH_PATH, COMPOSE_PATH, APPLICATIONS_PATH } = paths(
		!!runtimeWorkerId,
	);

	if (!customGitUrl || !customGitBranch) {
		command += `echo "Error: ❌ Repository not found"; exit 1;`;
		return command;
	}

	const basePath = type === "compose" ? COMPOSE_PATH : APPLICATIONS_PATH;
	const outputPath = outputPathOverride ?? join(basePath, appName, "code");
	const knownHostsPath = path.join(SSH_PATH, "known_hosts");

	if (!isHttpOrHttps(customGitUrl)) {
		if (!customGitSSHKeyId) {
			command += `echo "Error: ❌ You are trying to clone a ssh repository without a ssh key, please set a ssh key"; exit 1;`;
			return command;
		}
		command += addHostToKnownHostsCommand(customGitUrl);
	}
	command += `rm -rf ${quote([outputPath])};`;
	command += `mkdir -p ${quote([outputPath])};`;
	command += `echo ${quote([`Cloning Repo Custom ${customGitUrl} to ${outputPath}: ✅`])};`;

	if (customGitSSHKeyId) {
		await updateSSHKeyById({
			sshKeyId: customGitSSHKeyId,
			lastUsedAt: new Date().toISOString(),
		});
	}

	let cleanupKey = "";
	if (customGitSSHKeyId) {
		const sshKey = await findSSHKeyById(customGitSSHKeyId);
		const { port } = sanitizeRepoPathSSH(customGitUrl);
		// base64-encode the key in JS so its raw bytes never touch the shell
		// (PEM is normally safe, but a crafted key with quotes/`$`/backticks
		// would otherwise break out of the `echo`). Decode on the worker.
		const keyB64 = Buffer.from(sshKey.privateKey, "utf8").toString("base64");
		// Per-clone temp file (was a shared `/tmp/id_rsa` — concurrent clones
		// raced and clobbered each other's key). mktemp creates it mode 600.
		command += `DOCKLANDS_SSH_KEY="$(mktemp)";`;
		command += `printf '%s' '${keyB64}' | base64 -d > "$DOCKLANDS_SSH_KEY";`;
		command += `chmod 600 "$DOCKLANDS_SSH_KEY";`;
		const gitSshCommand = `ssh -i $DOCKLANDS_SSH_KEY${port ? ` -p ${port}` : ""} -o UserKnownHostsFile=${knownHostsPath} -o StrictHostKeyChecking=accept-new`;
		command += `export GIT_SSH_COMMAND="${gitSshCommand}";`;
		cleanupKey = `rm -f "$DOCKLANDS_SSH_KEY";`;
	}
	command += `if ! git clone --branch ${quote([customGitBranch ?? ""])} --depth 1 ${enableSubmodules ? "--recurse-submodules" : ""} --progress ${quote([customGitUrl])} ${quote([outputPath])}; then
				echo ${quote([`❌ [ERROR] Fail to clone the repository ${customGitUrl}`])};
				${cleanupKey}
				exit 1;
			fi
			`;
	command += cleanupKey;

	return command;
};

const isHttpOrHttps = (url: string): boolean => {
	const regex = /^https?:\/\//;
	return regex.test(url);
};

const addHostToKnownHostsCommand = (repositoryURL: string) => {
	const { SSH_PATH } = paths(true);
	const { domain, port } = sanitizeRepoPathSSH(repositoryURL);
	const knownHostsPath = path.join(SSH_PATH, "known_hosts");

	// ssh-keyscan is best-effort: some Git hosts (e.g. Hugging Face) never answer
	// it, and its exit code must not abort the clone under `set -e`. The clone's
	// own host-key check (StrictHostKeyChecking=accept-new) is the real boundary.
	return `ssh-keyscan -p ${port} ${quote([domain ?? ""])} >> ${quote([knownHostsPath])} || true;`;
};
const sanitizeRepoPathSSH = (input: string) => {
	const SSH_PATH_RE = new RegExp(
		[
			/^\s*/,
			/(?:(?<proto>[a-z]+):\/\/)?/,
			/(?:(?<user>[a-z_][a-z0-9_-]+)@)?/,
			/(?<domain>[^\s/?#:]+)/,
			/(?::(?<port>[0-9]{1,5}))?/,
			/(?:[/:](?<owner>[^\s/?#:]+))?/,
			/(?:[/:](?<repo>(?:[^\s?#:.]|\.(?!git\/?\s*$))+))/,
			/(?:.git)?\/?\s*$/,
		]
			.map((r) => r.source)
			.join(""),
		"i",
	);

	const found = input.match(SSH_PATH_RE);
	if (!found) {
		throw new Error(`Malformatted SSH path: ${input}`);
	}

	return {
		user: found.groups?.user ?? "git",
		domain: found.groups?.domain,
		port: Number(found.groups?.port ?? 22),
		owner: found.groups?.owner ?? "",
		repo: found.groups?.repo,
		get repoPath() {
			return `ssh://${this.user}@${this.domain}:${this.port}/${this.owner}${
				this.owner && "/"
			}${this.repo}.git`;
		},
	};
};

interface Props {
	appName: string;
	type?: "application" | "compose";
	runtimeWorkerId: string | null;
}

export const getGitCommitInfo = async ({
	appName,
	type = "application",
	runtimeWorkerId,
}: Props) => {
	const { COMPOSE_PATH, APPLICATIONS_PATH } = paths(!!runtimeWorkerId);
	const basePath = type === "compose" ? COMPOSE_PATH : APPLICATIONS_PATH;
	const outputPath = join(basePath, appName, "code");
	let stdoutResult = "";
	const result = {
		message: "",
		hash: "",
	};
	try {
		const gitCommand = `git -C ${quote([outputPath])} log -1 --pretty=format:"%H---DELIMITER---%B"`;
		if (runtimeWorkerId) {
			const { stdout } = await execAsyncRemote(runtimeWorkerId, gitCommand);
			stdoutResult = stdout.trim();
		} else {
			const { stdout } = await execAsync(gitCommand);
			stdoutResult = stdout.trim();
		}

		const parts = stdoutResult.split("---DELIMITER---");
		if (parts && parts.length === 2) {
			result.hash = parts[0]?.trim() || "";
			result.message = parts[1]?.trim() || "";
		}
	} catch (error) {
		logger.warn({ err: error, appName }, "Failed to read git commit info");
		return null;
	}
	return result;
};
