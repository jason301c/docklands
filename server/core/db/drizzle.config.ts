import { defineConfig } from "drizzle-kit";
import { dbUrl } from "@/server/core/db";

export default defineConfig({
	schema: "./server/core/db/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: dbUrl,
	},
	out: "drizzle",
	migrations: {
		table: "migrations",
		schema: "public",
	},
});
