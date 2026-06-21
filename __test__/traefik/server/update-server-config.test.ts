import { fs, vol } from "memfs";

vi.mock("node:fs", () => ({
	...fs,
	default: fs,
}));

import { beforeEach, expect, test, vi } from "vitest";
import type { webServerSettings } from "@/server/core/db/schema";
import { createDefaultServerTraefikConfig } from "@/server/core/setup/traefik-setup";
import { loadOrCreateConfig } from "@/server/core/utils/traefik/application";
import type { FileConfig } from "@/server/core/utils/traefik/file-types";
import { updateServerTraefik } from "@/server/core/utils/traefik/web-server";

type WebServerSettings = typeof webServerSettings.$inferSelect;

const baseSettings: WebServerSettings = {
	id: "",
	https: false,
	certificateType: "none",
	host: null,
	serverIp: null,
	letsEncryptEmail: null,
	sshPrivateKey: null,
	enableDockerCleanup: false,
	buildsConcurrency: 1,
	logCleanupCron: null,
	metricsConfig: {
		containers: {
			refreshRate: 20,
			services: {
				include: [],
				exclude: [],
			},
		},
		server: {
			type: "Docklands",
			cronJob: "",
			port: 4500,
			refreshRate: 20,
			retentionDays: 2,
			token: "",
			thresholds: {
				cpu: 0,
				memory: 0,
			},
			urlCallback: "",
		},
	},
	whitelabelingConfig: {
		appName: null,
		appDescription: null,
		logoUrl: null,
		faviconUrl: null,
		customCss: null,
		loginLogoUrl: null,
		supportUrl: null,
		docsUrl: null,
		errorPageTitle: null,
		errorPageDescription: null,
		metaTitle: null,
		footerText: null,
	},
	cleanupCacheApplications: false,
	cleanupCacheOnCompose: false,
	cleanupCacheOnPreviews: false,
	remoteServersOnly: false,
	createdAt: null,
	updatedAt: new Date(),
};

beforeEach(() => {
	vol.reset();
	createDefaultServerTraefikConfig();
});

test("Should read the configuration file", () => {
	const config: FileConfig = loadOrCreateConfig("docklands");
	expect(config.http?.routers?.["docklands-router-app"]?.service).toBe(
		"docklands-service-app",
	);
});

test("Should apply redirect-to-https", () => {
	updateServerTraefik(
		{
			...baseSettings,
			https: true,
			certificateType: "letsencrypt",
		},
		"example.com",
	);

	const config: FileConfig = loadOrCreateConfig("docklands");

	expect(config.http?.routers?.["docklands-router-app"]?.middlewares).toContain(
		"redirect-to-https",
	);
});

test("Should change only host when no certificate", () => {
	updateServerTraefik(baseSettings, "example.com");

	const config: FileConfig = loadOrCreateConfig("docklands");

	expect(config.http?.routers?.["docklands-router-app-secure"]).toBeUndefined();
});

test("Should not touch config without host", () => {
	const originalConfig: FileConfig = loadOrCreateConfig("docklands");

	updateServerTraefik(baseSettings, null);

	const config: FileConfig = loadOrCreateConfig("docklands");

	expect(originalConfig).toEqual(config);
});

test("Should remove websecure if https rollback to http", () => {
	updateServerTraefik(
		{ ...baseSettings, certificateType: "letsencrypt" },
		"example.com",
	);

	updateServerTraefik(
		{ ...baseSettings, certificateType: "none" },
		"example.com",
	);

	const config: FileConfig = loadOrCreateConfig("docklands");

	expect(config.http?.routers?.["docklands-router-app-secure"]).toBeUndefined();
	expect(
		config.http?.routers?.["docklands-router-app"]?.middlewares,
	).not.toContain("redirect-to-https");
});
