import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	appRouter: { _def: { procedures: {} } },
	createFetchTRPCContext: vi.fn(),
	createOpenApiFetchHandler: vi.fn(),
	logTRPCError: vi.fn(),
	validateRequestHeaders: vi.fn(),
}));

vi.mock("@/server/api/root", () => ({
	appRouter: mocks.appRouter,
}));

vi.mock("@/server/api/trpc", () => ({
	createFetchTRPCContext: mocks.createFetchTRPCContext,
	logTRPCError: mocks.logTRPCError,
}));

vi.mock("@/server/core/lib/auth", () => ({
	validateRequestHeaders: mocks.validateRequestHeaders,
}));

vi.mock("@/server/core/openapi/adapters/fetch.mjs", () => ({
	createOpenApiFetchHandler: mocks.createOpenApiFetchHandler,
}));

import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/[...openapi]/route";

const authenticatedSession = {
	session: { id: "session_1", activeOrganizationId: "org_1" },
	user: { id: "user_1" },
};

const request = (method: string) =>
	new Request("http://docklands.local/api/workspace.all", {
		headers: { "x-api-key": "dl_test_key" },
		method,
	});

describe("OpenAPI route handler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.validateRequestHeaders.mockResolvedValue({
			session: null,
			user: null,
		});
		mocks.createOpenApiFetchHandler.mockImplementation(({ req }) =>
			Promise.resolve(Response.json({ method: req.method }, { status: 202 })),
		);
	});

	it("returns 401 before dispatch when the request has no valid session or api key", async () => {
		const req = new Request("http://docklands.local/api/workspace.all");

		const response = await GET(req);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: "Unauthorized" });
		expect(mocks.validateRequestHeaders).toHaveBeenCalledWith(req.headers);
		expect(mocks.createOpenApiFetchHandler).not.toHaveBeenCalled();
	});

	it("delegates authenticated api key requests to the OpenAPI adapter", async () => {
		mocks.validateRequestHeaders.mockResolvedValue(authenticatedSession);
		const req = request("GET");

		const response = await GET(req);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ method: "GET" });
		expect(mocks.validateRequestHeaders).toHaveBeenCalledWith(req.headers);
		expect(req.headers.get("x-api-key")).toBe("dl_test_key");
		expect(mocks.createOpenApiFetchHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				createContext: mocks.createFetchTRPCContext,
				endpoint: "/api",
				req,
				router: mocks.appRouter,
			}),
		);
	});

	it("routes every exported HTTP method through the same authenticated adapter path", async () => {
		mocks.validateRequestHeaders.mockResolvedValue(authenticatedSession);
		const handlers = { DELETE, GET, PATCH, POST, PUT };

		for (const [method, handler] of Object.entries(handlers)) {
			const response = await handler(request(method));

			expect(response.status).toBe(202);
			expect(await response.json()).toEqual({ method });
		}

		expect(mocks.createOpenApiFetchHandler).toHaveBeenCalledTimes(5);
	});

	it("logs adapter errors with the OpenAPI error type", async () => {
		mocks.validateRequestHeaders.mockResolvedValue(authenticatedSession);
		const error = new Error("adapter failure");
		mocks.createOpenApiFetchHandler.mockImplementation(({ onError }) => {
			onError({ error, path: "workspace.all" });
			return Promise.resolve(new Response(null, { status: 204 }));
		});

		const response = await POST(request("POST"));

		expect(response.status).toBe(204);
		expect(mocks.logTRPCError).toHaveBeenCalledWith({
			error,
			path: "workspace.all",
			type: "openapi",
		});
	});
});
