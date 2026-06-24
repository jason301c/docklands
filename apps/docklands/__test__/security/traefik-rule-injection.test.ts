import { describe, expect, it } from "vitest";
import type { Domain } from "@/server/core/services/domain";
import type { ApplicationNested } from "@/server/core/utils/builders/index";
import { createRouterConfig } from "@/server/core/utils/traefik/domain";
import { domain as domainSchema } from "@/shared/validations/domain";

// Regression coverage for the Traefik router-rule injection class: host/path
// values are interpolated into `Host(`...`) && PathPrefix(`...`)` and middleware
// names into the router's `middlewares` list. A backtick (or other rule
// metacharacter) must never reach the generated config, or a single domain can
// break out of its matcher and become a catch-all that hijacks all ingress.

describe("domain validation schema (tRPC/OpenAPI boundary)", () => {
	it("accepts ordinary hostnames and paths", () => {
		const result = domainSchema.safeParse({
			host: "app.example.com",
			path: "/api/v1",
			https: false,
		});
		expect(result.success).toBe(true);
	});

	it("accepts a single leading wildcard label for wildcard certs", () => {
		const result = domainSchema.safeParse({ host: "*.example.com" });
		expect(result.success).toBe(true);
	});

	it("rejects a host that breaks out of the Host() matcher", () => {
		const result = domainSchema.safeParse({
			host: "evil.com`) || HostRegexp(`.+`) || Host(`x",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a host containing only a backtick", () => {
		expect(domainSchema.safeParse({ host: "a`b.com" }).success).toBe(false);
	});

	it("rejects a path that breaks out of the PathPrefix() matcher", () => {
		const result = domainSchema.safeParse({
			host: "app.example.com",
			path: "/`) || PathPrefix(`/",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a path that does not start with '/'", () => {
		expect(
			domainSchema.safeParse({ host: "app.example.com", path: "api" }).success,
		).toBe(false);
	});

	it("rejects middleware names with rule/YAML metacharacters", () => {
		const result = domainSchema.safeParse({
			host: "app.example.com",
			middlewares: ["valid-name", "`evil"],
		});
		expect(result.success).toBe(false);
	});

	it("accepts middleware names with an @provider suffix", () => {
		const result = domainSchema.safeParse({
			host: "app.example.com",
			middlewares: ["my-auth@file", "compress@docker"],
		});
		expect(result.success).toBe(true);
	});
});

// The builder is the real sink and is reached by internal callers (preview
// deployments, traefik.me generation) that do NOT pass through the input schema,
// so it must defend itself independently.
const baseApp = {
	appName: "myapp",
	redirects: [],
	security: [],
} as unknown as ApplicationNested;

const baseDomain = {
	host: "app.example.com",
	path: "/",
	https: false,
	uniqueConfigKey: 1,
	internalPath: "/",
	stripPath: false,
	customEntrypoint: null,
	certificateType: "none",
	middlewares: null,
	domainType: "application",
} as unknown as Domain;

describe("createRouterConfig (Traefik rule sink)", () => {
	it("builds a normal rule for a clean host and path", async () => {
		const router = await createRouterConfig(
			baseApp,
			{ ...baseDomain, host: "app.example.com", path: "/api" },
			"web",
		);
		expect(router.rule).toBe(
			"Host(`app.example.com`) && PathPrefix(`/api`)",
		);
	});

	it("throws when an internal caller supplies a host that breaks the rule", async () => {
		await expect(
			createRouterConfig(
				baseApp,
				{ ...baseDomain, host: "evil.com`) || HostRegexp(`.+`) || Host(`x" },
				"web",
			),
		).rejects.toThrow(/illegal characters/);
	});

	it("throws when an internal caller supplies a path that breaks the rule", async () => {
		await expect(
			createRouterConfig(
				baseApp,
				{ ...baseDomain, path: "/`) || PathPrefix(`/" },
				"web",
			),
		).rejects.toThrow(/illegal characters/);
	});

	it("throws when a custom middleware name is malicious", async () => {
		await expect(
			createRouterConfig(
				baseApp,
				{ ...baseDomain, middlewares: ["`evil"] },
				"web",
			),
		).rejects.toThrow(/illegal characters/);
	});
});
