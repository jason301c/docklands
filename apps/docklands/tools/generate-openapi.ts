#!/usr/bin/env tsx

/**
 * Script to generate the ignored local/release OpenAPI artifact.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenApiDocument } from "@/server/core/openapi/generator/index.mjs";
import type { OpenAPIObject } from "@/server/core/openapi/types";
import { siteConfig } from "@/shared/site";
import packageInfo from "../package.json";
import { appRouter } from "../server/api/root";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultOutputPath = resolve(__dirname, "../openapi.json");

export const createDocklandsOpenApiDocument = (): OpenAPIObject => {
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

	openApiDocument.security = [
		{
			apiKey: [],
		},
	];

	openApiDocument.externalDocs = {
		description: "Full documentation",
		url: siteConfig.links.github,
	};

	return openApiDocument;
};

export const writeDocklandsOpenApiDocument = (
	outputPath = defaultOutputPath,
) => {
	const openApiDocument = createDocklandsOpenApiDocument();
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, JSON.stringify(openApiDocument, null, 2), "utf-8");

	return {
		document: openApiDocument,
		endpointCount: Object.keys(openApiDocument.paths || {}).length,
		outputPath,
	};
};

async function generateOpenAPI() {
	try {
		console.log("🔄 Generating OpenAPI specification...");

		const outputPath = process.env.OPENAPI_OUTPUT_PATH
			? resolve(process.cwd(), process.env.OPENAPI_OUTPUT_PATH)
			: defaultOutputPath;
		const result = writeDocklandsOpenApiDocument(outputPath);

		console.log("✅ OpenAPI specification generated successfully!");
		console.log(`📄 Output: ${result.outputPath}`);
		console.log(`📊 Endpoints: ${result.endpointCount}`);
	} catch (error) {
		console.error("❌ Error generating OpenAPI specification:", error);
		process.exit(1);
	} finally {
		process.exit(0);
	}
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
	generateOpenAPI();
}
