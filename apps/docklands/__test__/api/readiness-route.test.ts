import type { Mock } from "vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as readinessGet } from "@/app/api/ready/route";
import { db } from "@/server/core/db";
import {
	markReadinessComplete,
	markReadinessStarting,
	markReadinessStepFailed,
	resetReadinessForTests,
} from "@/server/core/readiness";

const dbExecute = db.execute as unknown as Mock;

describe("readiness route", () => {
	beforeEach(() => {
		resetReadinessForTests("ready");
		dbExecute.mockReset();
		dbExecute.mockResolvedValue([]);
	});

	it("returns ready when the database and runtime bootstrap are ready", async () => {
		const response = await readinessGet();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.checks.database).toEqual({ ok: true });
		expect(body.checks.runtime.ok).toBe(true);
	});

	it("returns 503 when the database probe fails", async () => {
		dbExecute.mockRejectedValue(new Error("connection refused"));

		const response = await readinessGet();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.ok).toBe(false);
		expect(body.checks.database).toEqual({
			error: "database unreachable",
			ok: false,
		});
	});

	it("returns 503 while production bootstrap is still starting", async () => {
		resetReadinessForTests("starting");

		const response = await readinessGet();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.ok).toBe(false);
		expect(body.checks.runtime.phase).toBe("starting");
	});

	it("returns 503 when a critical bootstrap step fails", async () => {
		markReadinessStarting();
		markReadinessStepFailed("network", new Error("network missing"), {
			critical: true,
		});

		const response = await readinessGet();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.ok).toBe(false);
		expect(body.checks.runtime.phase).toBe("degraded");
		expect(body.checks.runtime.failedCriticalSteps).toEqual(["network"]);
	});

	it("allows readiness after noncritical bootstrap failures are recorded", async () => {
		markReadinessStarting();
		markReadinessStepFailed("tunnels", new Error("cloudflare unavailable"), {
			critical: false,
		});
		markReadinessComplete();

		const response = await readinessGet();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.checks.runtime.phase).toBe("ready");
		expect(body.checks.runtime.steps).toEqual([
			expect.objectContaining({
				critical: false,
				name: "tunnels",
				status: "failed",
			}),
		]);
	});
});
