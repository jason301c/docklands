#!/usr/bin/env tsx

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageInfo from "../package.json";
import { writeDocklandsOpenApiDocument } from "./generate-openapi";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

const run = () => {
	const tempDir = mkdtempSync(join(tmpdir(), "docklands-openapi-"));
	const outputPath = join(tempDir, "openapi.json");

	try {
		const { document, endpointCount } =
			writeDocklandsOpenApiDocument(outputPath);
		const generated = JSON.parse(readFileSync(outputPath, "utf8"));

		assert(
			document.info.version === packageInfo.version,
			`OpenAPI version ${document.info.version} does not match package version ${packageInfo.version}`,
		);
		assert(
			generated.info?.version === packageInfo.version,
			"Generated OpenAPI artifact did not persist package version metadata",
		);
		assert(endpointCount > 100, "Generated OpenAPI document has too few paths");
		assert(
			Object.keys(generated.paths ?? {}).length === endpointCount,
			"Generated OpenAPI path count changed during serialization",
		);

		const securityScheme = generated.components?.securitySchemes?.apiKey;
		assert(securityScheme?.type === "apiKey", "Missing apiKey security scheme");
		assert(
			securityScheme?.in === "header",
			"OpenAPI API key scheme must use a header",
		);
		assert(
			securityScheme?.name === "x-api-key",
			"OpenAPI API key scheme must use the x-api-key header",
		);
		assert(
			Array.isArray(generated.security) &&
				generated.security.some((entry: Record<string, unknown>) =>
					Object.hasOwn(entry, "apiKey"),
				),
			"OpenAPI document must apply the apiKey security scheme globally",
		);
		assert(
			!Object.hasOwn(
				generated.components?.securitySchemes ?? {},
				"Authorization",
			),
			"OpenAPI must not publish the old bearer Authorization scheme",
		);

		console.log(
			`OpenAPI check passed: version ${packageInfo.version}, ${endpointCount} paths`,
		);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
};

try {
	run();
	process.exit(0);
} catch (error) {
	console.error("OpenAPI check failed:", error);
	process.exit(1);
}
