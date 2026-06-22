import { describe, expect, it } from "vitest";
import {
	loadTemplateCatalog,
	loadTemplateDefinition,
} from "@/server/core/templates/catalog";
import { processComposeTemplate } from "@/server/core/templates/processors";

const mockOptions = {
	appName: "demo-directus",
	projectName: "demo-directus",
	serverIp: "127.0.0.1",
	defaultPort: 80,
};

function decodeJwtPayload(jwt: string) {
	const payload = jwt.split(".")[1];
	if (!payload) throw new Error("JWT payload segment is missing");
	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
		iss?: string;
		role?: string;
	};
}

describe("compose template catalog", () => {
	it("loads the vendored local template catalog", async () => {
		const templates = await loadTemplateCatalog();
		expect(templates.length).toBeGreaterThan(300);
		expect(
			templates.find((template) => template.id === "directus"),
		).toMatchObject({
			id: "directus",
			logo: "/templates/svgs/directus.svg",
		});
		expect(
			templates.find((template) => template.id === "posthog"),
		).toBeUndefined();
	});

	it("loads a template definition by id", async () => {
		const template = await loadTemplateDefinition("directus-with-postgresql");
		expect(template.metadata.id).toBe("directus-with-postgresql");
		expect(template.compose).toContain("services:");
		expect(template.compose).toContain("SERVICE_URL_DIRECTUS_8055");
	});
});

describe("processComposeTemplate", () => {
	it("generates env, URL/FQDN pairs, and domain records from magic service variables", () => {
		const compose = `
services:
  directus:
    image: directus/directus:11
    container_name: directus
    environment:
      - SERVICE_URL_DIRECTUS_8055=/admin
      - PUBLIC_URL=$SERVICE_URL_DIRECTUS_8055
      - DOMAIN_NAME=\${SERVICE_FQDN_DIRECTUS_8055}
      - ADMIN_PASSWORD=$SERVICE_PASSWORD_ADMIN
      - DB_PASSWORD=\${SERVICE_PASSWORD_POSTGRESQL}
    exclude_from_hc: true
  postgresql:
    image: postgres:16
    environment:
      - POSTGRES_USER=\${SERVICE_USER_POSTGRESQL}
      - POSTGRES_PASSWORD=\${SERVICE_PASSWORD_POSTGRESQL}
`;

		const result = processComposeTemplate(compose, mockOptions);

		expect(result.domains).toHaveLength(1);
		expect(result.domains[0]).toMatchObject({
			serviceName: "directus",
			port: 8055,
			path: "/admin",
		});
		expect(result.domains[0]?.host).toContain("directus-demo-directus");

		expect(result.envs).toContain("APP_NAME=demo-directus");
		expect(result.envs).toContain("COMPOSE_PROJECT_NAME=demo-directus");
		expect(result.envs).toContain("SERVICE_NAME_DIRECTUS=directus");
		expect(result.envs).toContain("SERVICE_NAME_POSTGRESQL=postgresql");
		expect(
			result.envs.some((env) =>
				env.startsWith("SERVICE_URL_DIRECTUS_8055=http://"),
			),
		).toBe(true);
		expect(
			result.envs.some((env) =>
				env.startsWith("SERVICE_FQDN_DIRECTUS_8055=directus-demo-directus"),
			),
		).toBe(true);
		expect(
			result.envs.some((env) => env.match(/^SERVICE_PASSWORD_ADMIN=.{32,}$/)),
		).toBe(true);
		expect(
			result.envs.some((env) =>
				env.match(/^SERVICE_PASSWORD_POSTGRESQL=.{32,}$/),
			),
		).toBe(true);
		expect(
			result.envs.some((env) => env.match(/^SERVICE_USER_POSTGRESQL=.{16}$/)),
		).toBe(true);

		expect(result.compose).not.toContain("container_name:");
		expect(result.compose).not.toContain("exclude_from_hc");
	});

	it("extracts default and required compose env variables into .env content", () => {
		const compose = `
services:
  app:
    image: example/app
    environment:
      - LOG_LEVEL=\${LOG_LEVEL:-info}
      - API_KEY=\${API_KEY:?}
      - HARD_CODED=ship
`;

		const result = processComposeTemplate(compose, mockOptions);

		expect(result.envs).toContain("LOG_LEVEL=info");
		expect(result.envs).toContain("API_KEY=");
		expect(result.envs).not.toContain("HARD_CODED=ship");
	});

	it("generates lowercase users and Supabase JWT service keys", () => {
		const compose = `
services:
  supabase-kong:
    image: kong:2
    environment:
      - SERVICE_URL_SUPABASEKONG_8000
      - DB_USER=\${SERVICE_LOWERCASEUSER_POSTGRES}
      - JWT_SECRET=\${SERVICE_PASSWORD_JWT}
      - SUPABASE_ANON_KEY=\${SERVICE_SUPABASEANON_KEY}
      - SUPABASE_SERVICE_KEY=\${SERVICE_SUPABASESERVICE_KEY}
`;

		const result = processComposeTemplate(compose, mockOptions);
		const envs = Object.fromEntries(
			result.envs.map((env) => {
				const index = env.indexOf("=");
				return [env.slice(0, index), env.slice(index + 1)];
			}),
		);

		expect(envs.SERVICE_LOWERCASEUSER_POSTGRES).toMatch(/^[a-z0-9]{16}$/);
		expect(envs.SERVICE_PASSWORD_JWT).toMatch(/^[a-z0-9]{32}$/);
		expect(decodeJwtPayload(envs.SERVICE_SUPABASEANON_KEY || "")).toMatchObject(
			{
				iss: "supabase",
				role: "anon",
			},
		);
		expect(
			decodeJwtPayload(envs.SERVICE_SUPABASESERVICE_KEY || ""),
		).toMatchObject({
			iss: "supabase",
			role: "service_role",
		});
	});

	it("resolves nested Compose defaults that reference magic variables", () => {
		const compose = `
services:
  healthchecks:
    image: healthchecks/healthchecks
    environment:
      - SERVICE_URL_HEALTHCHECKS_8000
      - SECRET_KEY=\${SECRET_KEY:?\${SERVICE_PASSWORD_64_HEALTHCHECKS}}
      - SITE_ROOT=\${SITE_ROOT:-\${SERVICE_URL_HEALTHCHECKS}}
`;

		const result = processComposeTemplate(compose, mockOptions);
		const envs = Object.fromEntries(
			result.envs.map((env) => {
				const index = env.indexOf("=");
				return [env.slice(0, index), env.slice(index + 1)];
			}),
		);

		expect(envs.SERVICE_PASSWORD_64_HEALTHCHECKS).toMatch(/^[a-z0-9]{64}$/);
		expect(envs.SECRET_KEY).toBe(envs.SERVICE_PASSWORD_64_HEALTHCHECKS);
		expect(envs.SITE_ROOT).toBe(envs.SERVICE_URL_HEALTHCHECKS);
		expect(envs.SERVICE_URL_HEALTHCHECKS).toBe(
			envs.SERVICE_URL_HEALTHCHECKS_8000,
		);
		expect(result.domains).toEqual([
			expect.objectContaining({
				serviceName: "healthchecks",
				port: 8000,
			}),
		]);
	});

	it("turns custom content and directory bind mounts into managed files", () => {
		const compose = `
services:
  homepage:
    image: ghcr.io/gethomepage/homepage
    volumes:
      - type: bind
        source: ./config/settings.yaml
        target: /app/config/settings.yaml
        content: |
          title: Docklands
      - type: bind
        source: ./config/logs
        target: /app/logs
        is_directory: true
`;

		const result = processComposeTemplate(compose, mockOptions);

		expect(result.mounts).toEqual([
			{
				filePath: "config/settings.yaml",
				mountPath: "/app/config/settings.yaml",
				content: "title: Docklands\n",
			},
			{
				filePath: "config/logs/",
				mountPath: "/app/logs",
				content: "",
			},
		]);
		expect(result.compose).toContain("source: ../files/config/settings.yaml");
		expect(result.compose).toContain("source: ../files/config/logs");
		expect(result.compose).not.toContain("content:");
		expect(result.compose).not.toContain("is_directory");
	});

	it("processes a real vendored Coolify-style template", async () => {
		const template = await loadTemplateDefinition("directus-with-postgresql");
		const result = processComposeTemplate(template.compose, {
			...mockOptions,
			defaultPort: template.metadata.port,
		});

		expect(result.compose).toContain("directus/directus");
		expect(result.domains).toContainEqual(
			expect.objectContaining({
				serviceName: "directus",
				port: 8055,
			}),
		);
		expect(
			result.envs.some((env) => env.startsWith("SERVICE_PASSWORD_POSTGRESQL=")),
		).toBe(true);
		expect(result.compose).not.toContain("SERVICE_URL_DIRECTUS_8055\n");
	});
});
