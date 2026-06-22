import { describe, expect, it } from "vitest";
import {
	createMenuForAuthUser,
	findActiveNavItem,
	isActiveRoute,
	type Menu,
} from "@/shared/dashboard-nav";

const fullPermissions = {
	certificate: { read: true },
	deployment: { read: true },
	destination: { read: true },
	docker: { read: true },
	gitProviders: { read: true },
	member: { read: true },
	monitoring: { read: true },
	notification: { read: true },
	organization: { update: true },
	registry: { read: true },
	server: { read: true },
	sshKeys: { read: true },
	tag: { read: true },
	traefikFiles: { read: true },
} as const;

const menuTitles = (menu: Menu) => ({
	home: menu.home.map((item) => item.title),
	settings: menu.settings.map((item) => item.title),
	runtime: (() => {
		const runtime = menu.settings.find((item) => item.title === "Runtime");
		if (runtime?.isSingle !== false) return [];
		return runtime.items.map((item) => item.title);
	})(),
});

describe("dashboard nav", () => {
	it("exposes the Railway-style self-hosted workspace labels", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
			isCloud: false,
		});

		expect(menuTitles(menu)).toEqual({
			home: ["Canvas", "Deployments", "Automations"],
			settings: [
				"Ingress",
				"Profile",
				"Build Workers",
				"Users",
				"SSH Keys",
				"Tags",
				"Git Providers",
				"Image Registry",
				"Storage",
				"Certificates",
				"Cluster Nodes",
				"Notifications",
				"Runtime",
			],
			runtime: [
				"Runtime Workers",
				"Container Runtime",
				"Cluster Runtime",
				"Ingress Requests",
				"Ingress Files",
				"Host Metrics",
			],
		});
		expect(
			menu.home.find((item) => item.title === "Deployments"),
		).toMatchObject({
			url: "/dashboard/deployments",
		});
	});

	it("keeps VM-only runtime controls out of cloud mode", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
			isCloud: true,
		});
		const titles = menuTitles(menu);

		expect(titles.settings).not.toContain("Ingress");
		expect(titles.settings).not.toContain("Build Workers");
		expect(titles.runtime).not.toContain("Ingress Requests");
		expect(titles.runtime).not.toContain("Host Metrics");
		expect(titles.settings).toContain("Profile");
		expect(titles.runtime).toEqual([
			"Runtime Workers",
			"Container Runtime",
			"Cluster Runtime",
			"Ingress Files",
		]);
	});

	it("keeps old admin nouns out of the visible navigation shell", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
			isCloud: false,
		});
		const titles = menuTitles(menu);
		const visibleTitles = [
			...titles.home,
			...titles.settings,
			...titles.runtime,
		];

		expect(visibleTitles).not.toContain("Networking");
		expect(visibleTitles).not.toContain("Builders");
		expect(visibleTitles).not.toContain("Registry");
		expect(visibleTitles).not.toContain("Nodes");
		expect(visibleTitles).not.toContain("Capacity");
		expect(visibleTitles).not.toContain("Containers");
		expect(visibleTitles).not.toContain("Cluster");
		expect(visibleTitles).not.toContain("Proxy Requests");
		expect(visibleTitles).not.toContain("Metrics");
	});

	it("treats legacy project routes as part of the Canvas area", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/workspace",
				pathname: "/dashboard/projects",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/workspace",
				pathname: "/dashboard/project/project_1/environment/env_1",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/workspace",
				pathname: "/dashboard/projector",
			}),
		).toBe(false);
	});

	it("keeps canonical workspace detail routes active under Canvas", () => {
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/workspace",
				pathname: "/dashboard/workspace/project_1/env_1",
			}),
		).toBe(true);
		expect(
			isActiveRoute({
				itemUrl: "/dashboard/deployments",
				pathname: "/dashboard/workspace/project_1/env_1",
			}),
		).toBe(false);
	});

	it("finds active nested runtime items for breadcrumbs", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
			isCloud: false,
		});

		expect(
			findActiveNavItem(
				[...menu.home, ...menu.settings],
				"/dashboard/host-metrics",
			)?.title,
		).toBe("Host Metrics");
		expect(
			findActiveNavItem(
				[...menu.home, ...menu.settings],
				"/dashboard/container-runtime",
			)?.title,
		).toBe("Container Runtime");
	});
});
