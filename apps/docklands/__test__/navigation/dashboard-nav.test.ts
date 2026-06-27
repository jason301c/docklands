import { describe, expect, it } from "vitest";
import {
	createMenuForAuthUser,
	findActiveNavItem,
	isActiveRoute,
	type Menu,
	type NavItem,
} from "@/shared/dashboard-nav";

const fullPermissions = {
	auditLog: { read: true },
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
	runtimeWorker: { read: true },
	sshKeys: { read: true },
	tag: { read: true },
	traefikFiles: { read: true },
	tunnel: { read: true },
} as const;

// The resolved permission set always carries every resource key (gates read
// nested actions without guarding), so a realistic "denied" fixture sets every
// key present-but-false rather than omitting it.
const emptyPermissions = {
	auditLog: { read: false },
	certificate: { read: false },
	deployment: { read: false },
	destination: { read: false },
	docker: { read: false },
	gitProviders: { read: false },
	member: { read: false },
	monitoring: { read: false },
	notification: { read: false },
	organization: { update: false },
	registry: { read: false },
	runtimeWorker: { read: false },
	sshKeys: { read: false },
	tag: { read: false },
	traefikFiles: { read: false },
	tunnel: { read: false },
} as const;

const subItems = (items: NavItem[], title: string) => {
	const group = items.find((item) => item.title === title);
	return group?.isSingle === false ? group.items.map((item) => item.title) : [];
};

const allTitles = (menu: Menu) =>
	[...menu.home, ...menu.settings].flatMap((item) =>
		item.isSingle === false
			? [item.title, ...item.items.map((sub) => sub.title)]
			: [item.title],
	);

describe("dashboard nav", () => {
	it("groups the nav into beginner-first sections", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
		});

		expect({
			home: menu.home.map((item) => item.title),
			settings: menu.settings.map((item) => item.title),
			domains: subItems(menu.home, "Domains"),
			monitoring: subItems(menu.home, "Monitoring"),
			teamAccess: subItems(menu.settings, "Team & Access"),
			connections: subItems(menu.settings, "Connections"),
			infrastructure: subItems(menu.settings, "Infrastructure"),
		}).toEqual({
			home: ["Setup", "Workspaces", "Deployments", "Domains", "Monitoring"],
			settings: [
				"Team & Access",
				"Connections",
				"Infrastructure",
				"Backups",
				"Notifications",
			],
			domains: ["Cloudflare Tunnels", "Ingress", "Certificates"],
			monitoring: ["Runtime", "Ingress"],
			teamAccess: ["Users", "Roles", "Audit Log"],
			connections: ["Git Providers", "Image Registry"],
			infrastructure: [
				"Runtime Workers",
				"Build Workers",
				"Cluster Nodes",
				"SSH Keys",
			],
		});

		expect(
			menu.home.find((item) => item.title === "Deployments"),
		).toMatchObject({
			url: "/dashboard/deployments",
		});
	});

	it("keeps old admin nouns and demoted items out of the sidebar", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
		});
		const titles = allTitles(menu);

		// Tags is demoted to the command palette, not the sidebar.
		expect(titles).not.toContain("Tags");
		// Old flat-list grouping labels are gone.
		expect(titles).not.toContain("Storage");
		expect(titles).not.toContain("Networking");
		expect(titles).not.toContain("Containers");
		expect(titles).not.toContain("Metrics");
	});

	it("prunes empty groups when no child is permitted", () => {
		// A user who can only read deployments sees Workspaces + Deployments,
		// but no Domains/Monitoring groups (all their children are gated away),
		// and an empty Settings group.
		const menu = createMenuForAuthUser({
			permissions: { ...emptyPermissions, deployment: { read: true } } as any,
		});

		expect(menu.home.map((item) => item.title)).toEqual([
			"Workspaces",
			"Deployments",
		]);
		expect(menu.settings).toEqual([]);
	});

	it("keeps canonical workspace detail routes active under the home group", () => {
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

	it("finds active nested items for breadcrumbs", () => {
		const menu = createMenuForAuthUser({
			permissions: fullPermissions as any,
		});

		expect(
			findActiveNavItem([...menu.home, ...menu.settings], "/dashboard/runtime")
				?.title,
		).toBe("Runtime");
		expect(
			findActiveNavItem([...menu.home, ...menu.settings], "/dashboard/ingress")
				?.title,
		).toBe("Ingress");
		expect(
			findActiveNavItem(
				[...menu.home, ...menu.settings],
				"/dashboard/settings/users",
			)?.title,
		).toBe("Users");
	});
});
