import { describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { POST as githubProviderWebhookPost } from "@/app/api/providers/github/webhook/route";

describe("App Router route handlers", () => {
	it("returns the health payload", async () => {
		const response = healthGet();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("redirects GitHub provider webhook setup callbacks", async () => {
		const response = await githubProviderWebhookPost(
			new Request("http://docklands.local/api/providers/github/webhook", {
				method: "POST",
			}),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(
			"http://docklands.local/dashboard/settings/git-providers",
		);
	});
});
