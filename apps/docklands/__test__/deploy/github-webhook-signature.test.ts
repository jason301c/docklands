import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the GitHub App webhook signature boundary
 * (`server/web/deploy/github-webhook.ts`).
 *
 * The handler resolves the per-installation webhook secret from the stored
 * `github` provider row, then verifies the request's `x-hub-signature-256`
 * header (HMAC-SHA256 over the exact body bytes, computed by
 * `@octokit/webhooks`) BEFORE doing any deployment work. These tests assert that
 * a missing or invalid signature is rejected and never reaches the deploy queue,
 * and that a correctly-signed payload passes verification.
 *
 * The deployment queue is mocked so we can assert `myQueue.add` is never called
 * on the rejection paths (and so importing the handler does not spin up the real
 * in-memory queue or register process signal handlers). The DB is mocked
 * per-test to supply a provider row with a known webhook secret.
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

// Mutable holder so each test can control the provider row the handler resolves.
let githubRowToReturn: {
	githubId: string;
	githubWebhookSecret: string;
} | null = null;
const githubFindFirst = vi.fn(() => Promise.resolve(githubRowToReturn));
const applicationsFindMany = vi.fn(() => Promise.resolve([]));
const composeFindMany = vi.fn(() => Promise.resolve([]));

vi.mock("@/server/core/db", () => ({
	db: {
		query: {
			github: { findFirst: githubFindFirst },
			applications: { findMany: applicationsFindMany },
			compose: { findMany: composeFindMany },
		},
	},
	dbUrl: "postgres://mock:mock@localhost:5432/mock",
}));

const { handleGithubDeployWebhook } = await import(
	"../../server/web/deploy/github-webhook"
);

const TEST_SECRET = "s3cr3t-webhook-key";
const INSTALLATION_ID = 4242;

/** Sign the exact bytes the handler verifies: `JSON.stringify(rawBody)`. */
const sign = (body: unknown, secret = TEST_SECRET) =>
	`sha256=${createHmac("sha256", secret)
		.update(JSON.stringify(body))
		.digest("hex")}`;

const makeRequest = (
	body: unknown,
	headers: Record<string, string> = {},
): Request =>
	new Request("http://docklands.test/api/deploy/github", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});

beforeEach(() => {
	vi.clearAllMocks();
	githubRowToReturn = {
		githubId: "gh_1",
		githubWebhookSecret: TEST_SECRET,
	};
});

describe("handleGithubDeployWebhook signature verification", () => {
	it("rejects a request with no x-hub-signature-256 header (401) without deploying", async () => {
		const body = { installation: { id: INSTALLATION_ID } };
		const res = await handleGithubDeployWebhook(makeRequest(body));

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({
			message: "Missing signature header",
		});
		expect(queueAdd).not.toHaveBeenCalled();
		// Bails before even looking up the provider.
		expect(githubFindFirst).not.toHaveBeenCalled();
	});

	it("rejects a request whose signature does not match the body (401)", async () => {
		const body = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/main",
		};
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": `sha256=${"0".repeat(64)}`,
				"x-github-event": "push",
			}),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ message: "Unauthorized" });
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("rejects a signature computed with a different secret (401)", async () => {
		const body = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/main",
		};
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				// Correctly-formed HMAC, but over the wrong secret.
				"x-hub-signature-256": sign(body, "the-wrong-secret"),
				"x-github-event": "push",
			}),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ message: "Unauthorized" });
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("rejects a signature whose body has been tampered with after signing (401)", async () => {
		const signedBody = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/main",
		};
		const signature = sign(signedBody);
		// Same installation (so the provider lookup still succeeds) but a different
		// ref, so the signed bytes no longer match.
		const tamperedBody = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/attacker",
		};

		const res = await handleGithubDeployWebhook(
			makeRequest(tamperedBody, {
				"x-hub-signature-256": signature,
				"x-github-event": "push",
			}),
		);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ message: "Unauthorized" });
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("accepts a valid HMAC-SHA256 signature and proceeds past verification", async () => {
		// A ping event: the simplest post-verification success path. Reaching the
		// 200 "webhook is active" response proves verification passed (an invalid
		// signature short-circuits at 401 before the event is inspected).
		const body = { installation: { id: INSTALLATION_ID } };
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": sign(body),
				"x-github-event": "ping",
			}),
		);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({
			message: "Ping received, webhook is active",
		});
		// Provider lookup happened with the installation id from the body.
		expect(githubFindFirst).toHaveBeenCalledTimes(1);
	});

	it("accepts a valid signature on a push and parses through to the deploy lookup", async () => {
		const body = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/main",
			repository: { name: "repo", owner: { name: "owner" } },
			head_commit: { id: "abc123", message: "feat: thing" },
			commits: [],
		};
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": sign(body),
				"x-github-event": "push",
			}),
		);

		// No matching apps configured -> "No apps to deploy", but crucially the
		// signature passed and the handler queried the app/compose tables.
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ message: "No apps to deploy" });
		expect(applicationsFindMany).toHaveBeenCalledTimes(1);
		expect(composeFindMany).toHaveBeenCalledTimes(1);
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("queues a deployment for a matching application on a valid signed push", async () => {
		applicationsFindMany.mockResolvedValueOnce([
			{
				applicationId: "app_1",
				watchPaths: null,
				runtimeWorkerId: null,
			},
		] as never);

		const body = {
			installation: { id: INSTALLATION_ID },
			ref: "refs/heads/main",
			repository: { name: "repo", owner: { name: "owner" } },
			head_commit: { id: "abc123", message: "feat: thing" },
			commits: [],
		};
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": sign(body),
				"x-github-event": "push",
			}),
		);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ message: "Deployed 1 apps" });
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

	it("rejects when the resolved provider has no webhook secret (400) even with a header present", async () => {
		githubRowToReturn = { githubId: "gh_1", githubWebhookSecret: "" };
		const body = { installation: { id: INSTALLATION_ID } };
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": sign(body),
				"x-github-event": "ping",
			}),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			message: "Github Webhook Secret not set",
		});
		expect(queueAdd).not.toHaveBeenCalled();
	});

	it("rejects when the installation id resolves to no provider (400)", async () => {
		githubRowToReturn = null;
		const body = { installation: { id: 999999 } };
		const res = await handleGithubDeployWebhook(
			makeRequest(body, {
				"x-hub-signature-256": sign(body),
				"x-github-event": "ping",
			}),
		);

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({
			message: "Github Installation not found",
		});
		expect(queueAdd).not.toHaveBeenCalled();
	});
});
