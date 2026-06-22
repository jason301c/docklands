import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnvironmentLegacyPage from "@/app/dashboard/project/[projectId]/environment/[environmentId]/page";
import ApplicationLegacyPage from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/application/[applicationId]/page";
import ComposeLegacyPage from "@/app/dashboard/project/[projectId]/environment/[environmentId]/services/compose/[composeId]/page";

vi.mock("next/navigation", () => ({
	redirect: vi.fn((href: string) => {
		throw new Error(`redirect:${href}`);
	}),
}));

const mockedRedirect = vi.mocked(redirect);

describe("legacy project route redirects", () => {
	beforeEach(() => {
		mockedRedirect.mockClear();
	});

	it("redirects old environment URLs to the canonical workspace canvas", async () => {
		await expect(
			EnvironmentLegacyPage({
				params: Promise.resolve({
					projectId: "project_1",
					environmentId: "env_1",
				}),
			}),
		).rejects.toThrow("redirect:/dashboard/workspace/project_1/env_1");

		expect(mockedRedirect).toHaveBeenCalledWith(
			"/dashboard/workspace/project_1/env_1",
		);
	});

	it("redirects old application service URLs and preserves the active tab", async () => {
		await expect(
			ApplicationLegacyPage({
				params: Promise.resolve({
					projectId: "project_1",
					environmentId: "env_1",
					applicationId: "app_1",
				}),
				searchParams: Promise.resolve({ tab: "deployments" }),
			}),
		).rejects.toThrow(
			"redirect:/dashboard/workspace/project_1/env_1/service/application/app_1?tab=deployments",
		);

		expect(mockedRedirect).toHaveBeenCalledWith(
			"/dashboard/workspace/project_1/env_1/service/application/app_1?tab=deployments",
		);
	});

	it("redirects old compose service URLs without adding a default tab query", async () => {
		await expect(
			ComposeLegacyPage({
				params: Promise.resolve({
					projectId: "project_1",
					environmentId: "env_1",
					composeId: "compose_1",
				}),
				searchParams: Promise.resolve({}),
			}),
		).rejects.toThrow(
			"redirect:/dashboard/workspace/project_1/env_1/service/compose/compose_1",
		);

		expect(mockedRedirect).toHaveBeenCalledWith(
			"/dashboard/workspace/project_1/env_1/service/compose/compose_1",
		);
	});
});
