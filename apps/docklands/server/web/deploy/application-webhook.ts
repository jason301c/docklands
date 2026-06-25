import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { applications } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import type { Bitbucket } from "@/server/core/services/bitbucket";
import { getBitbucketHeaders } from "@/server/core/utils/providers/bitbucket";
import { shouldDeploy } from "@/server/core/utils/watch-paths/should-deploy";
import type { DeploymentJob } from "@/server/queues/queue-types";
import { myQueue } from "@/server/queues/queueSetup";
import { checkDeployWebhookRateLimit } from "@/server/web/rate-limit";
import {
	jsonResponse,
	parseRequestBody,
	requestHeadersToObject,
} from "@/server/web/request";
import {
	type DeployWebhookBody,
	deployWebhookBodySchema,
} from "./webhook-schema";

const logger = createLogger("application-webhook");

/**
 * Validate an already-parsed webhook body against the lenient deploy schema.
 *
 * The schema only checks the fields the extractors read and passes everything
 * else through, so any real provider payload (always a JSON object) succeeds and
 * flows on unchanged. A non-object payload (string/array/number/undefined) fails
 * to parse; we substitute an empty object so the handler reaches the same
 * "couldn't act on it" responses (e.g. "Branch Not Match") it already returned
 * for a missing/empty body, instead of introducing a new status code that
 * webhook providers might choke on.
 */
export const validateDeployWebhookBody = (body: unknown): DeployWebhookBody => {
	const parsed = deployWebhookBodySchema.safeParse(body);
	return parsed.success ? parsed.data : {};
};

/**
 * Log a webhook handler error runtimeWorker-side without leaking its shape to the HTTP
 * response. Drizzle errors carry the raw SQL query, column list and parameters,
 * so we never forward the error object to the client.
 */
export const logWebhookError = (context: string, error: unknown) => {
	logger.error({ err: error }, context);
};

/**
 * Helper function to get package_version from registry_package events
 */
const getPackageVersion = (headers: any, body: DeployWebhookBody) => {
	const event = headers["x-github-event"];
	if (event === "registry_package") {
		return body.registry_package?.package_version;
	}
	return null;
};

export async function handleApplicationDeployWebhook(
	request: Request,
	refreshToken: string,
) {
	// The deploy webhook is unauthenticated (auth is the refresh token in the
	// path), so throttle by token hash first and client signal second. Proxy IP
	// headers are best-effort and may be spoofable in self-hosted deployments.
	if (!checkDeployWebhookRateLimit(request.headers, refreshToken)) {
		return jsonResponse({ error: "Too many requests" }, 429);
	}

	const headers = requestHeadersToObject(request.headers);
	const body = validateDeployWebhookBody(await parseRequestBody(request));

	try {
		if (headers["x-github-event"] === "ping") {
			return jsonResponse({ message: "Ping received, webhook is active" });
		}
		const application = await db.query.applications.findFirst({
			where: eq(applications.refreshToken, refreshToken),
			with: {
				environment: {
					with: {
						workspace: true,
					},
				},
				bitbucket: true,
			},
		});

		if (!application) {
			return jsonResponse({ message: "Application Not Found" }, 404);
		}
		if (!application?.autoDeploy) {
			logger.info(
				{ applicationId: application.applicationId, appName: application.name },
				"Webhook received but autoDeploy is disabled",
			);
			return jsonResponse(
				{
					message: "Automatic deployments are disabled for this application",
				},
				400,
			);
		}

		const deploymentTitle = extractCommitMessage(headers, body);

		const deploymentHash = extractHash(headers, body);
		const sourceType = application.sourceType;

		if (sourceType === "docker") {
			const applicationImageName = extractImageName(application.dockerImage);
			const applicationDockerTag = extractImageTag(application.dockerImage);

			const webhookImageName = extractImageNameFromRequest(headers, body);
			const webhookDockerTag = extractImageTagFromRequest(headers, body);

			if (!applicationImageName) {
				return jsonResponse(
					{
						message: "Application Docker Image Name Not Found",
					},
					301,
				);
			}

			// If webhook provides image information, validate it matches the configured image
			// If webhook doesn't provide image information, fall back to using the configured image (backward compatibility)
			if (webhookImageName) {
				// Validate image name matches
				if (webhookImageName !== applicationImageName) {
					return jsonResponse(
						{
							message: `Application Image Name (${applicationImageName}) doesn't match request event payload Image Name (${webhookImageName}).`,
						},
						301,
					);
				}

				if (!applicationDockerTag) {
					return jsonResponse(
						{
							message: "Application Docker Tag Not Found",
						},
						301,
					);
				}

				if (webhookDockerTag) {
					if (webhookDockerTag !== applicationDockerTag) {
						return jsonResponse(
							{
								message: `Application Image Tag (${applicationDockerTag}) doesn't match request event payload Image Tag (${webhookDockerTag}).`,
							},
							301,
						);
					}
				}
			}
			// If webhook doesn't provide image info, we'll use the configured image (old behavior)
		} else if (sourceType === "github") {
			const normalizedCommits = body?.commits?.flatMap(
				(commit) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				application.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}

			const branchName = extractBranchName(headers, body);
			if (!branchName || branchName !== application.branch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		} else if (sourceType === "git") {
			const branchName = extractBranchName(headers, body);

			if (!branchName || branchName !== application.customGitBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}

			const provider = getProviderByHeader(headers);
			let normalizedCommits: (string | undefined)[] | undefined = [];

			if (provider === "github") {
				normalizedCommits = body?.commits?.flatMap((commit) => commit.modified);
			} else if (provider === "gitlab") {
				normalizedCommits = body?.commits?.flatMap((commit) => commit.modified);
			} else if (provider === "gitea") {
				normalizedCommits = body?.commits?.flatMap((commit) => commit.modified);
			} else if (provider === "soft-serve") {
				normalizedCommits = body?.commits?.flatMap((commit) => commit.modified);
			}

			const shouldDeployPaths = shouldDeploy(
				application.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}
		} else if (sourceType === "gitlab") {
			const branchName = extractBranchName(headers, body);

			const normalizedCommits = body?.commits?.flatMap(
				(commit) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				application.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}

			if (!branchName || branchName !== application.gitlabBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		} else if (sourceType === "bitbucket") {
			const branchName = extractBranchName(headers, body);

			if (!branchName || branchName !== application.bitbucketBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}

			const committedPaths = await extractCommittedPaths(
				body,
				application.bitbucket,
				application.bitbucketRepositorySlug ||
					application.bitbucketRepository ||
					"",
			);

			const shouldDeployPaths = shouldDeploy(
				application.watchPaths,
				committedPaths,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}
		} else if (sourceType === "gitea") {
			const branchName = extractBranchName(headers, body);

			const normalizedCommits = body?.commits?.flatMap(
				(commit) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				application.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}

			if (!branchName || branchName !== application.giteaBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		}

		try {
			const jobData: DeploymentJob = {
				applicationId: application.applicationId as string,
				titleLog: deploymentTitle,
				// Behavior-identical to the previous conditional spread: when there
				// is no hash the consumer defaulted the omitted field to "" anyway
				// (services/application.ts `descriptionLog = ""`), so an empty string
				// here produces the same downstream result.
				descriptionLog: deploymentHash ? `Hash: ${deploymentHash}` : "",
				type: "deploy",
				applicationType: "application",
				runtimeWorker: !!application.runtimeWorkerId,
			};

			await myQueue.add(
				"deployments",
				{ ...jobData },
				{
					removeOnComplete: true,
					removeOnFail: true,
				},
			);
			logger.info(
				{
					applicationId: application.applicationId,
					appName: application.name,
					sourceType: application.sourceType,
				},
				"Application deploy job enqueued",
			);
		} catch (error) {
			logWebhookError("Error deploying Application:", error);
			return jsonResponse({ message: "Error deploying Application" }, 400);
		}

		return jsonResponse({ message: "Application deployed successfully" });
	} catch (error) {
		logWebhookError("Error deploying Application:", error);
		return jsonResponse({ message: "Error deploying Application" }, 400);
	}
}

/**
 * Return the image name without the tag
 * Example: "my-image" => "my-image"
 * Example: "my-image:latest" => "my-image"
 * Example: "my-image:1.0.0" => "my-image"
 * Example: "myregistryhost:5000/fedora/httpd:version1.0" => "myregistryhost:5000/fedora/httpd"
 * @link https://docs.docker.com/reference/cli/docker/image/tag/
 */
export function extractImageName(dockerImage: string | null): string | null {
	if (!dockerImage || typeof dockerImage !== "string") {
		return null;
	}

	// Handle case where there's no tag (no colon or colon is part of port number)
	const lastColonIndex = dockerImage.lastIndexOf(":");
	if (lastColonIndex === -1) {
		return dockerImage;
	}

	// Check if the part after the last colon looks like a tag (not a port number)
	// Port numbers are typically 1-5 digits, tags are usually longer or contain letters
	const afterColon = dockerImage.substring(lastColonIndex + 1);
	const isPortNumber = /^\d{1,5}$/.test(afterColon);

	// If it's a port number (like registry:5000/image), don't split
	if (isPortNumber) {
		return dockerImage;
	}

	// Otherwise, split at the last colon to get image name
	return dockerImage.substring(0, lastColonIndex);
}

/**
 * Return the last part of the image name, which is the tag
 * Example: "my-image" => null
 * Example: "my-image:latest" => "latest"
 * Example: "my-image:1.0.0" => "1.0.0"
 * Example: "myregistryhost:5000/fedora/httpd:version1.0" => "version1.0"
 * @link https://docs.docker.com/reference/cli/docker/image/tag/
 */
export function extractImageTag(dockerImage: string | null) {
	if (!dockerImage || typeof dockerImage !== "string") {
		return null;
	}

	const lastColonIndex = dockerImage.lastIndexOf(":");
	if (lastColonIndex === -1) {
		return "latest";
	}

	const afterColon = dockerImage.substring(lastColonIndex + 1);
	const isPortWithPath = /^\d{1,5}\//.test(afterColon);

	if (isPortWithPath) {
		return "latest";
	}

	return afterColon;
}

/**
 * Extract the image name (without tag) from webhook request
 * @link https://docs.docker.com/docker-hub/webhooks/#example-webhook-payload
 * @link https://docs.github.com/en/webhooks/webhook-events-and-payloads#registry_package
 */
export const extractImageNameFromRequest = (
	headers: any,
	body: DeployWebhookBody,
): string | null => {
	// GitHub Packages: registry_package events (container registry)
	const packageVersion = getPackageVersion(headers, body);
	if (packageVersion?.package_url) {
		const packageUrl = packageVersion.package_url;
		// Remove tag if present (everything after the last colon)
		if (packageUrl.includes(":")) {
			const lastColonIndex = packageUrl.lastIndexOf(":");
			// Check if it's a port number (like registry:5000/image)
			const afterColon = packageUrl.substring(lastColonIndex + 1);
			const isPortNumber = /^\d{1,5}$/.test(afterColon);
			if (isPortNumber) {
				return packageUrl;
			}
			return packageUrl.substring(0, lastColonIndex);
		}
		return packageUrl;
	}

	// Docker Hub
	if (headers["user-agent"]?.includes("Go-http-client")) {
		if (body.repository) {
			const repoName = body.repository.repo_name;
			return `${repoName}`;
		}
	}
	return null;
};

/**
 * @link https://docs.docker.com/docker-hub/webhooks/#example-webhook-payload
 * @link https://docs.github.com/en/webhooks/webhook-events-and-payloads#registry_package
 */
export const extractImageTagFromRequest = (
	headers: any,
	body: DeployWebhookBody,
): string | null => {
	// GitHub Packages: registry_package events (container registry)
	const packageVersion = getPackageVersion(headers, body);
	if (packageVersion) {
		// Try to get tag from container_metadata first (most reliable)
		// Only use it if it's not empty and not the same as the version (digest)
		const tagName = packageVersion.container_metadata?.tag?.name?.trim() || "";
		if (
			tagName &&
			tagName !== packageVersion.version &&
			!tagName.startsWith("sha256:")
		) {
			return tagName;
		}
		// Fallback: extract tag from package_url (e.g., "ghcr.io/owner/repo:tag")
		if (packageVersion.package_url) {
			const packageUrl = packageVersion.package_url;
			// Handle case where package_url ends with colon (no tag)
			if (packageUrl.endsWith(":")) {
				return null;
			}
			const tagMatch = packageUrl.match(/:([^:]+)$/);
			if (tagMatch?.[1]?.trim()) {
				return tagMatch[1].trim();
			}
		}
	}

	// Docker Hub
	if (headers["user-agent"]?.includes("Go-http-client")) {
		if (body.push_data && body.repository) {
			return body.push_data.tag ?? null;
		}
	}
	return null;
};

export const extractCommitMessage = (headers: any, body: DeployWebhookBody) => {
	// GitHub Packages: registry_package events (container tags)
	const githubEvent = headers["x-github-event"];
	if (githubEvent === "registry_package") {
		const packageVersion = getPackageVersion(headers, body);
		if (packageVersion) {
			if (packageVersion.package_url) {
				return `Docker GHCR image pushed: ${packageVersion.package_url}`;
			}
			return "Docker GHCR image pushed";
		}
		// If package_version is missing, fall through to default behavior
	}
	// GitHub
	if (headers["x-github-event"]) {
		return body.head_commit ? body.head_commit.message! : "NEW COMMIT";
	}

	// GitLab
	if (headers["x-gitlab-event"]) {
		return body.commits && body.commits.length > 0
			? body.commits[0]!.message!
			: "NEW COMMIT";
	}

	// Bitbucket
	// Unguarded `body.push!...` access is intentional: the original `any` code
	// threw here when the payload lacked these fields, and the caller's
	// try/catch turned that into the existing 400. The casts keep
	// that exact runtime behavior (they compile to no-ops).
	if (headers["x-event-key"]?.includes("repo:push")) {
		return body.push!.changes && body.push!.changes.length > 0
			? body.push!.changes[0]!.new!.target!.message!
			: "NEW COMMIT";
	}

	// Gitea
	if (headers["x-gitea-event"]) {
		return body.commits && body.commits.length > 0
			? body.commits[0]!.message!
			: "NEW COMMIT";
	}

	// Soft Serve
	if (headers["x-softserve-event"]) {
		return body.commits && body.commits.length > 0
			? body.commits[0]!.message!
			: "NEW COMMIT";
	}

	if (headers["user-agent"]?.includes("Go-http-client")) {
		if (body.push_data && body.repository) {
			return `DockerHub image pushed: ${body.repository.repo_name}:${body.push_data.tag} by ${body.push_data.pusher}`;
		}
	}

	return "NEW CHANGES";
};

export const extractHash = (headers: any, body: DeployWebhookBody) => {
	// GitHub
	if (headers["x-github-event"]) {
		return body.head_commit ? body.head_commit.id! : "";
	}

	// GitLab
	if (headers["x-gitlab-event"]) {
		return (
			body.checkout_sha ||
			(body.commits && body.commits.length > 0
				? body.commits[0]!.id!
				: "NEW COMMIT")
		);
	}

	// Bitbucket — see note in extractCommitMessage on the intentional throw.
	if (headers["x-event-key"]?.includes("repo:push")) {
		return body.push!.changes && body.push!.changes.length > 0
			? body.push!.changes[0]!.new!.target!.hash!
			: "NEW COMMIT";
	}

	// Gitea
	if (headers["x-gitea-event"]) {
		return body.after || "NEW COMMIT";
	}

	// Soft Serve
	if (headers["x-softserve-event"]) {
		return body.after || "NEW COMMIT";
	}

	return "";
};

export const extractBranchName = (headers: any, body: DeployWebhookBody) => {
	if (headers["x-github-event"] || headers["x-gitea-event"]) {
		return body?.ref?.replace("refs/heads/", "");
	}

	if (
		headers["x-gitlab-event"] ||
		headers["x-softserve-event"]?.includes("push")
	) {
		return body?.ref ? body?.ref.replace("refs/heads/", "") : null;
	}

	// Bitbucket — `changes[0]` is accessed unguarded exactly as before; it threw
	// when `changes` was absent and the caller's try/catch produced the 400.
	if (headers["x-event-key"]?.includes("repo:push")) {
		return (body?.push?.changes as { new?: { name?: string } }[])[0]?.new?.name;
	}

	return null;
};

export const getProviderByHeader = (headers: any) => {
	if (headers["x-github-event"]) {
		return "github";
	}

	if (headers["x-gitea-event"]) {
		return "gitea";
	}

	if (headers["x-gitlab-event"]) {
		return "gitlab";
	}

	if (headers["x-event-key"]?.includes("repo:push")) {
		return "bitbucket";
	}

	if (headers["x-softserve-event"]) {
		return "soft-serve";
	}

	return null;
};

export const extractCommittedPaths = async (
	body: DeployWebhookBody,
	bitbucket: Bitbucket | null,
	repository: string,
) => {
	const changes = body.push?.changes || [];

	const commitHashes = changes
		.map((change) => change.new?.target?.hash)
		.filter(Boolean);
	const committedPaths: string[] = [];
	const username =
		bitbucket?.bitbucketWorkspaceName || bitbucket?.bitbucketUsername || "";
	for (const commit of commitHashes) {
		const url = `https://api.bitbucket.org/2.0/repositories/${username}/${repository}/diffstat/${commit}`;
		try {
			const response = await fetch(url, {
				headers: getBitbucketHeaders(bitbucket!),
			});
			const data = await response.json();
			for (const value of data.values) {
				if (value?.new?.path) committedPaths.push(value.new.path);
			}
		} catch (error) {
			logger.warn(
				{ err: error, provider: "bitbucket", commit },
				"Error fetching Bitbucket diffstat",
			);
			return [];
		}
	}

	return committedPaths;
};
