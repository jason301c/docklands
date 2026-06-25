#!/usr/bin/env tsx

/**
 * Script to generate OpenAPI specification locally
 * This writes openapi.json for local docs/tooling consumers.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenApiDocument } from "@/server/core/openapi/generator/index.mjs";
import { siteConfig } from "@/shared/site";
import packageInfo from "../package.json";
import { appRouter } from "../server/api/root";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOpenAPI() {
	try {
		console.log("🔄 Generating OpenAPI specification...");

		const openApiDocument = generateOpenApiDocument(appRouter, {
			title: "Docklands API",
			version: packageInfo.version,
			baseUrl: "https://your-docklands-instance.example/api",
			docsUrl: siteConfig.links.github,
			tags: [
				"admin",
				"docker",
				"compose",
				"registry",
				"cluster",
				"user",
				"domain",
				"destination",
				"backup",
				"deployment",
				"mounts",
				"certificates",
				"settings",
				"security",
				"redirects",
				"port",
				"workspace",
				"application",
				"mysql",
				"postgres",
				"redis",
				"mongo",
				"mariadb",
				"sshRouter",
				"gitProvider",
				"bitbucket",
				"github",
				"gitlab",
				"gitea",
				"runtimeWorker",
				"swarm",
				"organization",
				"rollback",
				"volumeBackups",
				"environment",
			],
		});

		// Enhance metadata
		openApiDocument.info = {
			title: "Docklands API",
			description:
				"Complete API documentation for Docklands - Deploy applications, manage databases, and orchestrate your infrastructure. This API allows you to programmatically manage all aspects of your Docklands instance.",
			version: packageInfo.version,
			contact: {
				name: "Docklands Team",
				url: siteConfig.links.github,
			},
			license: {
				name: "Apache 2.0",
				url: `${siteConfig.links.github}/blob/canary/LICENSE.MD`,
			},
		};

		// Add security schemes
		openApiDocument.components = {
			...openApiDocument.components,
			securitySchemes: {
				apiKey: {
					type: "apiKey",
					in: "header",
					name: "x-api-key",
					description:
						"API key authentication. Generate an API key from your Docklands dashboard under Settings > API Keys.",
				},
			},
		};

		// Apply global security
		openApiDocument.security = [
			{
				apiKey: [],
			},
		];

		// Add external docs
		openApiDocument.externalDocs = {
			description: "Full documentation",
			url: siteConfig.links.github,
		};

		// Write to this app package root.
		const outputPath = resolve(__dirname, "../openapi.json");
		writeFileSync(
			outputPath,
			JSON.stringify(openApiDocument, null, 2),
			"utf-8",
		);

		console.log("✅ OpenAPI specification generated successfully!");
		console.log(`📄 Output: ${outputPath}`);
		console.log(
			`📊 Endpoints: ${Object.keys(openApiDocument.paths || {}).length}`,
		);
	} catch (error) {
		console.error("❌ Error generating OpenAPI specification:", error);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

generateOpenAPI();
