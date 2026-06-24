import { z } from "zod";

/**
 * Lenient zod schemas for deploy-webhook payloads.
 *
 * These validate ONLY the fields the webhook extractors actually read, and they
 * are deliberately permissive: every field is optional and every object
 * `.passthrough()`es unknown keys. The goal is to stop `any`-dereferencing
 * crashes on hostile input and turn a non-object payload into a controlled
 * response — NOT to reject any payload that real Git/registry providers send.
 *
 * Mirror the tolerance of the original `any` code: it read fields through
 * optional chaining and fallbacks, so a field that is "sometimes absent" must
 * stay `.optional()`. When in doubt, under-validate. The success path must stay
 * behavior-identical for every payload that works today, so a body that parses
 * here flows into the exact same extractor logic as before.
 */

/** A single commit entry (GitHub/GitLab/Gitea/Soft Serve `commits[]`). */
const commitSchema = z
	.object({
		message: z.string().optional(),
		id: z.string().optional(),
		// `flatMap((c) => c.modified)` — array of changed paths.
		modified: z.array(z.string()).optional(),
	})
	.passthrough();

/** Bitbucket `push.changes[]` entry. */
const bitbucketChangeSchema = z
	.object({
		new: z
			.object({
				name: z.string().optional(),
				target: z
					.object({
						message: z.string().optional(),
						hash: z.string().optional(),
					})
					.passthrough()
					.optional(),
				path: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

/** GitHub Packages `registry_package.package_version`. */
const packageVersionSchema = z
	.object({
		package_url: z.string().optional(),
		version: z.string().optional(),
		container_metadata: z
			.object({
				tag: z
					.object({
						name: z.string().optional(),
					})
					.passthrough()
					.optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

/**
 * The body shape shared by the application + compose refresh-token webhooks.
 * Covers GitHub/GitLab/Gitea/Soft Serve push payloads, Bitbucket push payloads,
 * Docker Hub payloads, and GitHub Packages registry_package payloads. Every
 * branch is optional because which fields are present depends entirely on the
 * provider (resolved from request headers), exactly as the original code
 * assumed.
 */
export const deployWebhookBodySchema = z
	.object({
		ref: z.string().optional(),
		after: z.string().optional(),
		checkout_sha: z.string().optional(),
		head_commit: z
			.object({
				message: z.string().optional(),
				id: z.string().optional(),
			})
			.passthrough()
			.optional(),
		commits: z.array(commitSchema).optional(),
		// Bitbucket
		push: z
			.object({
				changes: z.array(bitbucketChangeSchema).optional(),
			})
			.passthrough()
			.optional(),
		// Docker Hub
		repository: z
			.object({
				repo_name: z.string().optional(),
			})
			.passthrough()
			.optional(),
		push_data: z
			.object({
				tag: z.string().optional(),
				pusher: z.string().optional(),
			})
			.passthrough()
			.optional(),
		// GitHub Packages
		registry_package: z
			.object({
				package_version: packageVersionSchema.optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export type DeployWebhookBody = z.infer<typeof deployWebhookBodySchema>;

/**
 * The body shape for the signed GitHub App webhook (`/api/deploy/github`).
 *
 * NOTE: signature verification still runs against the ORIGINAL parsed body (the
 * exact object produced from the request text), never against the result of
 * this parse — `.passthrough()` reorders keys, which would change the
 * re-stringified bytes and break HMAC verification. This schema is only used to
 * read fields safely after verification has already passed.
 */
export const githubWebhookBodySchema = z
	.object({
		ref: z.string().optional(),
		action: z.string().optional(),
		installation: z
			.object({
				// GitHub sends a numeric installation id; the lookup compares it
				// against the stored value, so keep it permissive.
				id: z.union([z.number(), z.string()]).optional(),
			})
			.passthrough()
			.optional(),
		repository: z
			.object({
				name: z.string().optional(),
				owner: z
					.object({
						name: z.string().optional(),
						login: z.string().optional(),
					})
					.passthrough()
					.optional(),
			})
			.passthrough()
			.optional(),
		commits: z.array(commitSchema).optional(),
		head_commit: z
			.object({
				message: z.string().optional(),
				id: z.string().optional(),
			})
			.passthrough()
			.optional(),
		pull_request: z
			.object({
				id: z.union([z.number(), z.string()]).optional(),
				number: z.union([z.number(), z.string()]).optional(),
				title: z.string().optional(),
				html_url: z.string().optional(),
				head: z
					.object({
						sha: z.string().optional(),
						ref: z.string().optional(),
					})
					.passthrough()
					.optional(),
				base: z
					.object({
						ref: z.string().optional(),
					})
					.passthrough()
					.optional(),
				user: z
					.object({
						login: z.string().optional(),
					})
					.passthrough()
					.optional(),
				labels: z
					.array(
						z
							.object({
								name: z.string().optional(),
							})
							.passthrough(),
					)
					.optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export type GithubWebhookBody = z.infer<typeof githubWebhookBodySchema>;
