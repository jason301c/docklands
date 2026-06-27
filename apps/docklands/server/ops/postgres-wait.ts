export type PostgresTarget = {
	host: string;
	port: number;
	database: string;
	user: string;
};

export function resolvePostgresTargetFromUrl(
	databaseUrl: string,
): PostgresTarget {
	const url = new URL(databaseUrl);
	const host = url.hostname;

	if (!host) {
		throw new Error("DATABASE_URL has no hostname");
	}

	return {
		host,
		port: Number(url.port || 5432),
		database: decodeURIComponent(url.pathname.replace(/^\//, "")),
		user: decodeURIComponent(url.username),
	};
}

export function getPostgresErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const code = "code" in error ? error.code : undefined;
	return typeof code === "string" ? code : undefined;
}

export function isFatalPostgresConfigError(error: unknown): boolean {
	const code = getPostgresErrorCode(error);
	const message = error instanceof Error ? error.message : String(error);

	return (
		code === "28000" ||
		code === "28P01" ||
		code === "3D000" ||
		/role ".+" does not exist/i.test(message) ||
		/database ".+" does not exist/i.test(message) ||
		/password authentication failed/i.test(message)
	);
}

export function formatPostgresConnectionFailure(
	error: unknown,
	target: PostgresTarget,
): string {
	const message = error instanceof Error ? error.message : String(error);
	const lines = [
		`[wait-for-postgres] Postgres is listening at ${target.host}:${target.port}, but DATABASE_URL could not connect as ${target.user || "<empty user>"} to ${target.database || "<empty database>"}.`,
		`[wait-for-postgres] Database error: ${message}`,
	];

	if (isFatalPostgresConfigError(error)) {
		lines.push(
			"[wait-for-postgres] This usually means an unrelated Postgres is already using the port, or apps/docklands/.env points at a role/database that has not been created.",
			"[wait-for-postgres] For Local-mode dev, stop conflicting Postgres services and run `bun run dev` so the docklands-dev-postgres container owns the configured port.",
			"[wait-for-postgres] Alternatively, update DATABASE_URL to a database/user that already exists.",
		);
	}

	return lines.join("\n");
}
