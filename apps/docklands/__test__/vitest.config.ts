import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["__test__/**/*.test.ts"], // Incluir solo los archivos de test en el directorio __test__
		exclude: ["**/node_modules/**", "**/dist/**", "**/.docker/**"],
		pool: "forks",
		setupFiles: [path.resolve(__dirname, "setup.ts")],
		// Coverage is opt-in via `bun run test:coverage` (v8 instrumentation adds
		// ~80s, so it is intentionally NOT in the default test:ci gate). It is scoped
		// to the genuinely test-covered core (server + shared) so the thresholds are
		// meaningful — the UI tree is largely untested and would only dilute the
		// number. Thresholds are a conservative floor a few points below the current
		// baseline (~21% lines): they catch a coverage collapse without failing on
		// normal churn. Raise them as coverage grows.
		coverage: {
			provider: "v8",
			reporter: ["text-summary", "html", "lcov"],
			include: ["server/**", "shared/**"],
			exclude: ["**/*.test.ts", "**/__test__/**", "server/ops/**"],
			thresholds: {
				statements: 18,
				branches: 13,
				functions: 13,
				lines: 18,
			},
		},
	},
	define: {
		"process.env": {
			NODE: "test",
		},
	},
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@/server/core": path.resolve(__dirname, "../server/core"),
		},
	},
});
