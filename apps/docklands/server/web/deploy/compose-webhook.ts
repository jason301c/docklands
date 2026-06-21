import { eq } from "drizzle-orm";
import { IS_CLOUD } from "@/server/core/constants/env";
import { db } from "@/server/core/db";
import { compose } from "@/server/core/db/schema";
import { deploy } from "@/server/core/runtime/deploy";
import { shouldDeploy } from "@/server/core/utils/watch-paths/should-deploy";
import type { DeploymentJob } from "@/server/queues/queue-types";
import { myQueue } from "@/server/queues/queueSetup";
import {
	jsonResponse,
	parseRequestBody,
	requestHeadersToObject,
} from "@/server/web/request";
import {
	extractBranchName,
	extractCommitMessage,
	extractCommittedPaths,
	extractHash,
	getProviderByHeader,
	logWebhookError,
} from "./application-webhook";

export async function handleComposeDeployWebhook(
	request: Request,
	refreshToken: string,
) {
	const headers = requestHeadersToObject(request.headers);
	const body = await parseRequestBody(request);

	try {
		if (headers["x-github-event"] === "ping") {
			return jsonResponse({ message: "Ping received, webhook is active" });
		}
		const composeResult = await db.query.compose.findFirst({
			where: eq(compose.refreshToken, refreshToken),
			with: {
				environment: {
					with: {
						project: true,
					},
				},
				bitbucket: true,
			},
		});

		if (!composeResult) {
			return jsonResponse({ message: "Compose Not Found" }, 404);
		}
		if (!composeResult?.autoDeploy) {
			return jsonResponse(
				{
					message: "Automatic deployments are disabled for this compose",
				},
				400,
			);
		}

		const deploymentTitle = extractCommitMessage(headers, body);
		const deploymentHash = extractHash(headers, body);
		const sourceType = composeResult.sourceType;

		if (sourceType === "github") {
			const branchName = extractBranchName(headers, body);
			const normalizedCommits = body?.commits?.flatMap(
				(commit: any) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				composeResult.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}

			if (!branchName || branchName !== composeResult.branch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		} else if (sourceType === "gitlab") {
			const branchName = extractBranchName(headers, body);
			const normalizedCommits = body?.commits?.flatMap(
				(commit: any) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				composeResult.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}
			if (!branchName || branchName !== composeResult.gitlabBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		} else if (sourceType === "bitbucket") {
			const branchName = extractBranchName(headers, body);
			if (!branchName || branchName !== composeResult.bitbucketBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}

			const committedPaths = await extractCommittedPaths(
				body,
				composeResult.bitbucket,
				composeResult.bitbucketRepositorySlug ||
					composeResult.bitbucketRepository ||
					"",
			);

			const shouldDeployPaths = shouldDeploy(
				composeResult.watchPaths,
				committedPaths,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}
		} else if (sourceType === "git") {
			const branchName = extractBranchName(headers, body);
			if (!branchName || branchName !== composeResult.customGitBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
			const provider = getProviderByHeader(headers);
			let normalizedCommits: string[] = [];

			if (provider === "github") {
				normalizedCommits = body?.commits?.flatMap(
					(commit: any) => commit.modified,
				);
			} else if (provider === "gitlab") {
				normalizedCommits = body?.commits?.flatMap(
					(commit: any) => commit.modified,
				);
			} else if (provider === "gitea") {
				normalizedCommits = body?.commits?.flatMap(
					(commit: any) => commit.modified,
				);
			}

			const shouldDeployPaths = shouldDeploy(
				composeResult.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}
		} else if (sourceType === "gitea") {
			const branchName = extractBranchName(headers, body);

			const normalizedCommits = body?.commits?.flatMap(
				(commit: any) => commit.modified,
			);

			const shouldDeployPaths = shouldDeploy(
				composeResult.watchPaths,
				normalizedCommits,
			);

			if (!shouldDeployPaths) {
				return jsonResponse({ message: "Watch Paths Not Match" }, 301);
			}

			if (!branchName || branchName !== composeResult.giteaBranch) {
				return jsonResponse({ message: "Branch Not Match" }, 301);
			}
		}

		try {
			const jobData: DeploymentJob = {
				composeId: composeResult.composeId as string,
				titleLog: deploymentTitle,
				type: "deploy",
				applicationType: "compose",
				descriptionLog: `Hash: ${deploymentHash}`,
				server: !!composeResult.serverId,
			};

			if (IS_CLOUD && composeResult.serverId) {
				jobData.serverId = composeResult.serverId;
				deploy(jobData).catch((error) => {
					console.error("Background deployment failed:", error);
				});
			} else {
				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}
		} catch (error) {
			logWebhookError("Error deploying Compose:", error);
			return jsonResponse({ message: "Error deploying Compose" }, 400);
		}

		return jsonResponse({ message: "Compose deployed successfully" });
	} catch (error) {
		logWebhookError("Error deploying Compose:", error);
		return jsonResponse({ message: "Error deploying Compose" }, 400);
	}
}
