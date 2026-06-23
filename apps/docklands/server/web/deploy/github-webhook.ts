import { Webhooks } from "@octokit/webhooks";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { applications, compose, github } from "@/server/core/db/schema";
import {
	createSecurityBlockedComment,
	findGithubById,
} from "@/server/core/services/github";
import {
	createPreviewDeployment,
	findPreviewDeploymentByApplicationId,
	findPreviewDeploymentsByPullRequestId,
	refreshPreviewDeploymentExpiration,
	removePreviewDeployment,
} from "@/server/core/services/preview-deployment";
import { checkUserRepositoryPermissions } from "@/server/core/utils/providers/github";
import { shouldDeploy } from "@/server/core/utils/watch-paths/should-deploy";
import type { DeploymentJob } from "@/server/queues/queue-types";
import { myQueue } from "@/server/queues/queueSetup";
import {
	jsonResponse,
	parseRequestBody,
	requestHeadersToObject,
} from "@/server/web/request";
import {
	extractCommitMessage,
	extractHash,
	logWebhookError,
} from "./application-webhook";

export async function handleGithubDeployWebhook(request: Request) {
	const headers = requestHeadersToObject(request.headers);
	const githubBody = await parseRequestBody(request);
	const signature = headers["x-hub-signature-256"];

	if (!signature) {
		return jsonResponse({ message: "Missing signature header" }, 401);
	}

	if (!githubBody?.installation?.id) {
		return jsonResponse({ message: "Github Installation not found" }, 400);
	}

	const githubResult = await db.query.github.findFirst({
		where: eq(github.githubInstallationId, githubBody.installation.id),
	});

	if (!githubResult) {
		return jsonResponse({ message: "Github Installation not found" }, 400);
	}

	if (!githubResult.githubWebhookSecret) {
		return jsonResponse({ message: "Github Webhook Secret not set" }, 400);
	}
	const webhooks = new Webhooks({
		secret: githubResult.githubWebhookSecret,
	});

	const verified = await webhooks.verify(
		JSON.stringify(githubBody),
		signature as string,
	);

	if (!verified) {
		return jsonResponse({ message: "Unauthorized" }, 401);
	}

	if (headers["x-github-event"] === "ping") {
		return jsonResponse({ message: "Ping received, webhook is active" });
	}

	if (
		headers["x-github-event"] !== "push" &&
		headers["x-github-event"] !== "pull_request"
	) {
		return jsonResponse(
			{ message: "We only accept push events or pull_request events" },
			400,
		);
	}

	// skip workflow runs use keywords
	// @link https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs
	if (
		[
			"[skip ci]",
			"[ci skip]",
			"[no ci]",
			"[skip actions]",
			"[actions skip]",
		].find((keyword) =>
			extractCommitMessage(headers, githubBody).includes(keyword),
		)
	) {
		return jsonResponse({
			message: "Deployment skipped: commit message contains skip keyword",
		});
	}

	// Handle tag creation event
	if (
		headers["x-github-event"] === "push" &&
		githubBody?.ref?.startsWith("refs/tags/")
	) {
		try {
			const tagName = githubBody?.ref.replace("refs/tags/", "");
			const repository = githubBody?.repository?.name;
			const owner = githubBody?.repository?.owner?.name;
			const deploymentTitle = `Tag created: ${tagName}`;
			const deploymentHash = extractHash(headers, githubBody);

			// Find applications configured to deploy on tag
			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.autoDeploy, true),
					eq(applications.triggerType, "tag"),
					eq(applications.repository, repository),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
			});

			for (const app of apps) {
				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: deploymentTitle,
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application",
					runtimeWorker: !!app.runtimeWorkerId,
				};

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			// Find compose apps configured to deploy on tag
			const composeApps = await db.query.compose.findMany({
				where: and(
					eq(compose.sourceType, "github"),
					eq(compose.autoDeploy, true),
					eq(compose.triggerType, "tag"),
					eq(compose.repository, repository),
					eq(compose.owner, owner),
					eq(compose.githubId, githubResult.githubId),
				),
			});

			for (const composeApp of composeApps) {
				const jobData: DeploymentJob = {
					composeId: composeApp.composeId as string,
					titleLog: deploymentTitle,
					type: "deploy",
					applicationType: "compose",
					descriptionLog: `Hash: ${deploymentHash}`,
					runtimeWorker: !!composeApp.runtimeWorkerId,
				};

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const totalApps = apps.length + composeApps.length;

			if (totalApps === 0) {
				return jsonResponse({
					message: "No apps configured to deploy on tag",
				});
			}

			return jsonResponse({
				message: `Deployed ${totalApps} apps based on tag ${tagName}`,
			});
		} catch (error) {
			logWebhookError("Error deploying applications on tag:", error);
			return jsonResponse(
				{ message: "Error deploying applications on tag" },
				400,
			);
		}
	}

	if (headers["x-github-event"] === "push") {
		try {
			const branchName = githubBody?.ref?.replace("refs/heads/", "");
			const repository = githubBody?.repository?.name;

			const deploymentTitle = extractCommitMessage(headers, githubBody);
			const deploymentHash = extractHash(headers, githubBody);
			const owner = githubBody?.repository?.owner?.name;
			const normalizedCommits = githubBody?.commits?.flatMap(
				(commit: any) => commit.modified,
			);

			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.autoDeploy, true),
					eq(applications.triggerType, "push"),
					eq(applications.branch, branchName),
					eq(applications.repository, repository),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
			});

			for (const app of apps) {
				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: deploymentTitle,
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application",
					runtimeWorker: !!app.runtimeWorkerId,
				};

				const shouldDeployPaths = shouldDeploy(
					app.watchPaths,
					normalizedCommits,
				);

				if (!shouldDeployPaths) {
					continue;
				}

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const composeApps = await db.query.compose.findMany({
				where: and(
					eq(compose.sourceType, "github"),
					eq(compose.autoDeploy, true),
					eq(compose.triggerType, "push"),
					eq(compose.branch, branchName),
					eq(compose.repository, repository),
					eq(compose.owner, owner),
					eq(compose.githubId, githubResult.githubId),
				),
			});

			for (const composeApp of composeApps) {
				const jobData: DeploymentJob = {
					composeId: composeApp.composeId as string,
					titleLog: deploymentTitle,
					type: "deploy",
					applicationType: "compose",
					descriptionLog: `Hash: ${deploymentHash}`,
					runtimeWorker: !!composeApp.runtimeWorkerId,
				};

				const shouldDeployPaths = shouldDeploy(
					composeApp.watchPaths,
					normalizedCommits,
				);

				if (!shouldDeployPaths) {
					continue;
				}

				await myQueue.add(
					"deployments",
					{ ...jobData },
					{
						removeOnComplete: true,
						removeOnFail: true,
					},
				);
			}

			const totalApps = apps.length + composeApps.length;
			const emptyApps = totalApps === 0;

			if (emptyApps) {
				return jsonResponse({ message: "No apps to deploy" });
			}
			return jsonResponse({ message: `Deployed ${totalApps} apps` });
		} catch (error) {
			logWebhookError("Error deploying Application:", error);
			return jsonResponse({ message: "Error deploying Application" }, 400);
		}
	} else if (headers["x-github-event"] === "pull_request") {
		const prId = githubBody?.pull_request?.id;
		const action = githubBody?.action;

		if (action === "closed") {
			const previewDeploymentResult =
				await findPreviewDeploymentsByPullRequestId(prId);

			if (previewDeploymentResult.length > 0) {
				for (const previewDeployment of previewDeploymentResult) {
					try {
						await removePreviewDeployment(
							previewDeployment.previewDeploymentId,
						);
					} catch (error) {
						console.log(error);
					}
				}
			}
			return jsonResponse({ message: "Preview Deployment Closed" });
		}

		// opened or synchronize or reopened
		if (
			action === "opened" ||
			action === "synchronize" ||
			action === "reopened" ||
			action === "labeled" ||
			action === "unlabeled"
		) {
			const shouldCreateDeployment =
				action === "opened" ||
				action === "synchronize" ||
				action === "reopened" ||
				action === "labeled";

			const repository = githubBody?.repository?.name;
			const deploymentHash = githubBody?.pull_request?.head?.sha;
			const branch = githubBody?.pull_request?.base?.ref;
			const owner = githubBody?.repository?.owner?.login;
			const prAuthor = githubBody?.pull_request?.user?.login;

			// Validate PR author information is present
			if (!prAuthor) {
				console.warn(
					"⚠️ SECURITY: PR author information missing in webhook payload",
				);
				return jsonResponse(
					{
						message: "PR author information missing",
					},
					400,
				);
			}

			const apps = await db.query.applications.findMany({
				where: and(
					eq(applications.sourceType, "github"),
					eq(applications.repository, repository),
					eq(applications.branch, branch),
					eq(applications.isPreviewDeploymentsActive, true),
					eq(applications.owner, owner),
					eq(applications.githubId, githubResult.githubId),
				),
				with: {
					previewDeployments: true,
				},
			});

			// SECURITY: Check collaborator permissions per application setting
			const secureApps: typeof apps = [];
			const blockedApps: string[] = [];
			let userPermission: string | null = null;

			for (const app of apps) {
				// If the app requires collaborator permissions, verify them
				if (app.previewRequireCollaboratorPermissions !== false) {
					try {
						const githubProvider = await findGithubById(githubResult.githubId);
						const { hasWriteAccess, permission } =
							await checkUserRepositoryPermissions(
								githubProvider,
								owner,
								repository,
								prAuthor,
							);

						userPermission = permission; // Store permission for comment

						if (!hasWriteAccess) {
							console.warn(
								`🚨 SECURITY: Blocked preview deployment for ${app.name} from unauthorized user ${prAuthor} on ${owner}/${repository}. Permission: ${permission || "none"}`,
							);
							blockedApps.push(app.name);
							continue;
						}

						console.log(
							`✅ SECURITY: Preview deployment authorized for ${app.name} from user ${prAuthor} on ${owner}/${repository}. Permission: ${permission}`,
						);
					} catch (error) {
						console.error(
							`Error validating PR author permissions for ${app.name}:`,
							error,
						);
						blockedApps.push(app.name);
						continue; // Skip this app on error
					}
				} else {
					console.warn(
						`⚠️  SECURITY: Preview deployment for ${app.name} allows deployment from any PR author (security check disabled)`,
					);
				}
				secureApps.push(app);
			}

			const prBranch = githubBody?.pull_request?.head?.ref;

			const prNumber = githubBody?.pull_request?.number;
			const prTitle = githubBody?.pull_request?.title;
			const prURL = githubBody?.pull_request?.html_url;

			// Create security notification comment if any apps were blocked
			if (blockedApps.length > 0) {
				await createSecurityBlockedComment({
					owner,
					repository,
					prNumber: Number.parseInt(prNumber, 10),
					prAuthor,
					permission: userPermission,
					githubId: githubResult.githubId,
				});
			}

			for (const app of secureApps) {
				// check for labels
				if (app?.previewLabels && app?.previewLabels?.length > 0) {
					let hasLabel = false;
					const labels = githubBody?.pull_request?.labels;
					for (const label of labels) {
						if (app?.previewLabels?.includes(label.name)) {
							hasLabel = true;
							break;
						}
					}
					if (!hasLabel) continue;
				}

				// Re-deploys of an existing preview for this PR are always allowed
				// (they don't count against the cap); the limit only gates the
				// creation of brand-new previews.
				const previewDeploymentResult =
					await findPreviewDeploymentByApplicationId(app.applicationId, prId);

				let previewDeploymentId =
					previewDeploymentResult?.previewDeploymentId || "";

				if (!previewDeploymentResult && shouldCreateDeployment) {
					const previewLimit = app?.previewLimit ?? 3;
					// A non-positive limit disables new preview environments.
					if (previewLimit <= 0) {
						continue;
					}
					// Evict the oldest preview(s) so this new one stays within the
					// cap, instead of silently skipping it once the cap is hit.
					const existingPreviews = app?.previewDeployments ?? [];
					const overBy = existingPreviews.length - (previewLimit - 1);
					if (overBy > 0) {
						const oldest = [...existingPreviews]
							.sort(
								(a, b) =>
									new Date(a.createdAt).getTime() -
									new Date(b.createdAt).getTime(),
							)
							.slice(0, overBy);
						for (const stale of oldest) {
							await removePreviewDeployment(stale.previewDeploymentId);
						}
					}
					const previewDeployment = await createPreviewDeployment({
						applicationId: app.applicationId as string,
						branch: prBranch,
						pullRequestId: prId,
						pullRequestNumber: prNumber,
						pullRequestTitle: prTitle,
						pullRequestURL: prURL,
					});
					previewDeploymentId = previewDeployment.previewDeploymentId;
				} else if (previewDeploymentResult) {
					// Refresh the expiry window on every redeploy of an open PR so
					// actively-updated previews are never reaped before abandoned ones.
					await refreshPreviewDeploymentExpiration(
						previewDeploymentId,
						app?.previewExpirationDays ?? 0,
					);
				}

				const jobData: DeploymentJob = {
					applicationId: app.applicationId as string,
					titleLog: "Preview Deployment",
					descriptionLog: `Hash: ${deploymentHash}`,
					type: "deploy",
					applicationType: "application-preview",
					runtimeWorker: !!app.runtimeWorkerId,
					previewDeploymentId,
				};

				if (previewDeploymentId) {
					await myQueue.add(
						"deployments",
						{ ...jobData },
						{
							removeOnComplete: true,
							removeOnFail: true,
						},
					);
				}
			}
			return jsonResponse({ message: "Apps Deployed" });
		}
	}

	return jsonResponse({ message: "No Actions matched" }, 400);
}
