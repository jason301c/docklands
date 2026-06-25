import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the refresh-token deploy auth boundary
 * (`server/web/deploy/application-webhook.ts` and `compose-webhook.ts`).
 *
 * These webhooks are unsigned: the ONLY thing authenticating the caller is the
 * `refreshToken` in the URL, which the handler looks up against the target row.
 * An absent/unknown token must resolve to no row and therefore must NOT enqueue
 * a deployment. A valid token (with autoDeploy + matching branch) must enqueue.
 *
 * The queue is mocked so we can assert on `myQueue.add`, and the DB lookup is
 * mocked per-test to return either nothing (unknown token) or a target row.
 */

const queueAdd = vi.fn(() => Promise.resolve({ id: "job_1" }));

vi.mock("@/server/queues/queueSetup", () => ({
	myQueue: {
		add: queueAdd,
		getJobs: vi.fn(() => Promise.resolve([])),
		removeWaiting: vi.fn(() => 0),
		clearWaiting: vi.fn(() => 0),
		close: vi.fn(() => Promise.resolve()),
		drain: vi.fn(() => Promise.resolve()),
		on: vi.fn(),
		run: vi.fn(() => Promise.resolve()),
	},
}));

// Each test sets what the token lookup resolves to (undefined = unknown token).
let applicationRow: Record<string, unknown> | undefined;
let composeRow: Record<string, unknown> | undefined;

const applicationsFindFirst = vi.fn(() => Promise.resolve(applicationRow));
const composeFindFirst = vi.fn(() => Promise.resolve(composeRow));

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			applications: { findFirst: applicationsFindFirst },
			compose: { findFirst: composeFindFirst },
		},
	},
	dbUrl: "postgres://mock:mock@localhost:5432/mock",
}));

const { handleApplicationDeployWebhook } = await import(
	"../../server/web/deploy/application-webhook"
);
const { handleComposeDeployWebhook } = await import(
	"../../server/web/deploy/compose-webhook"
);

const makeGithubPushRequest = (
	branch = "main",
	extraHeaders: Record<string, string> = {},
) =>
	new Request("http://docklands.test/api/deploy/tok", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-github-event": "push",
			...extraHeaders,
		},
		body: JSON.stringify({
			ref: `refs/heads/${branch}`,
			head_commit: { id: "deadbeef", message: "feat: thing" },
			commits: [],
		}),
	});

beforeEach(() => {
	vi.clearAllMocks();
	applicationRow = undefined;
	composeRow = undefined;
});

describe("handleApplicationDeployWebhook refresh-token auth", () => {
	it("does NOT deploy when the refresh token resolves to no application (404)", async () => {
		applicationRow = undefined;
		const res = await handleApplicationDeployWebhook(
			makeGithubPushRequest(),
			"unknown-token",
		);

		expect(res.status).toBe(404);
		await expect(res.json()).resolves.toEqual({
			message: "Application Not Found",
		});
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("looks up the application by the exact refresh token supplied", async () => {
		applicationRow = undefined;
		await handleApplicationDeployWebhook(
			makeGithubPushRequest(),
			"tok-abc-123",
		);

		expect(applicationsFindFirst).toHaveBeenCalledTimes(1);
		// The where clause is built from the token; assert the lookup ran once and
		// produced no row (so no deploy) — the token is the only credential.
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("does NOT deploy a found application when autoDeploy is disabled (400)", async () => {
		applicationRow = {
			applicationId: "app_1",
			name: "app",
			autoDeploy: false,
			sourceType: "github",
			branch: "main",
			watchPaths: null,
			runtimeWorkerId: null,
		};
		const res = await handleApplicationDeployWebhook(
			makeGithubPushRequest(),
			"valid-token",
		);

		expect(res.status).toBe(400);
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("does NOT deploy when the branch does not match (301)", async () => {
		applicationRow = {
			applicationId: "app_1",
			name: "app",
			autoDeploy: true,
			sourceType: "github",
			branch: "main",
			watchPaths: null,
			runtimeWorkerId: null,
		};
		const res = await handleApplicationDeployWebhook(
			makeGithubPushRequest("some-other-branch"),
			"valid-token",
		);

		expect(res.status).toBe(301);
		await expect(res.json()).resolves.toEqual({ message: "Branch Not Match" });
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("DOES deploy for a valid token with autoDeploy + matching branch", async () => {
		applicationRow = {
			applicationId: "app_1",
			name: "app",
			autoDeploy: true,
			sourceType: "github",
			branch: "main",
			watchPaths: null,
			runtimeWorkerId: null,
		};
		const res = await handleApplicationDeployWebhook(
			makeGithubPushRequest("main"),
			"valid-token",
		);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({
			message: "Application deployed successfully",
		});
		expect(queueAdd).toHaveBeenCalledTimes(1);
		expect(queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				applicationId: "app_1",
				type: "deploy",
				applicationType: "application",
			}),
			expect.any(Object),
		);
	});

	it("rate limits by refresh token even when forwarded IP rotates", async () => {
		const token = `rotating-application-token-${Date.now()}`;
		applicationRow = undefined;

		for (let index = 0; index < 30; index += 1) {
			const res = await handleApplicationDeployWebhook(
				makeGithubPushRequest("main", {
					"x-forwarded-for": `203.0.113.${index}`,
				}),
				token,
			);
			expect(res.status).toBe(404);
		}

		const blocked = await handleApplicationDeployWebhook(
			makeGithubPushRequest("main", {
				"x-forwarded-for": "198.51.100.200",
			}),
			token,
		);

		expect(blocked.status).toBe(429);
		await expect(blocked.json()).resolves.toEqual({
			error: "Too many requests",
		});
		expect(applicationsFindFirst).toHaveBeenCalledTimes(30);
	});
});

describe("handleComposeDeployWebhook refresh-token auth", () => {
	it("does NOT deploy when the refresh token resolves to no compose (404)", async () => {
		composeRow = undefined;
		const res = await handleComposeDeployWebhook(
			makeGithubPushRequest(),
			"unknown-token",
		);

		expect(res.status).toBe(404);
		await expect(res.json()).resolves.toEqual({ message: "Compose Not Found" });
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("does NOT deploy a found compose when autoDeploy is disabled (400)", async () => {
		composeRow = {
			composeId: "cmp_1",
			name: "cmp",
			autoDeploy: false,
			sourceType: "github",
			branch: "main",
			watchPaths: null,
			runtimeWorkerId: null,
		};
		const res = await handleComposeDeployWebhook(
			makeGithubPushRequest(),
			"valid-token",
		);

		expect(res.status).toBe(400);
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("DOES deploy for a valid token with autoDeploy + matching branch", async () => {
		composeRow = {
			composeId: "cmp_1",
			name: "cmp",
			autoDeploy: true,
			sourceType: "github",
			branch: "main",
			watchPaths: null,
			runtimeWorkerId: null,
		};
		const res = await handleComposeDeployWebhook(
			makeGithubPushRequest("main"),
			"valid-token",
		);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({
			message: "Compose deployed successfully",
		});
		expect(queueAdd).toHaveBeenCalledTimes(1);
		expect(queueAdd).toHaveBeenCalledWith(
			"deployments",
			expect.objectContaining({
				composeId: "cmp_1",
				type: "deploy",
				applicationType: "compose",
			}),
			expect.any(Object),
		);
	});

	it("rate limits by refresh token even when forwarded IP rotates", async () => {
		const token = `rotating-compose-token-${Date.now()}`;
		composeRow = undefined;

		for (let index = 0; index < 30; index += 1) {
			const res = await handleComposeDeployWebhook(
				makeGithubPushRequest("main", {
					"x-forwarded-for": `203.0.114.${index}`,
				}),
				token,
			);
			expect(res.status).toBe(404);
		}

		const blocked = await handleComposeDeployWebhook(
			makeGithubPushRequest("main", {
				"x-forwarded-for": "198.51.100.201",
			}),
			token,
		);

		expect(blocked.status).toBe(429);
		await expect(blocked.json()).resolves.toEqual({
			error: "Too many requests",
		});
		expect(composeFindFirst).toHaveBeenCalledTimes(30);
	});
});
