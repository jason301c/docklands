import { execFileSync } from "node:child_process";
import net from "node:net";
import { dbUrl } from "@/server/core/db/constants";
import { createLogger } from "@/server/core/lib/logger";
import { resolvePostgresTargetFromUrl } from "./postgres-wait";

/**
 * Local-mode (workstation) Postgres provisioner.
 *
 * This is the self-healing first step of `bun run dev`: it guarantees the app
 * has a reachable Postgres without the operator running the full server install
 * path (`setup-instance`, which inits Swarm/Traefik and is for real servers, not
 * laptops). It is deliberately minimal — a single throwaway Postgres container —
 * so Local mode never mutates Docker Swarm, networks, or ports beyond one DB.
 *
 * Behavior:
 *   - If DATABASE_URL already accepts a TCP connection, do nothing.
 *   - Otherwise, when DATABASE_URL points at a loopback host and Docker is
 *     available, create (or start) a `docklands-dev-postgres` container with the
 *     URL's credentials, publishing the URL's port.
 *   - Otherwise, print actionable guidance and exit non-zero.
 *
 * It refuses to run under NODE_ENV=production: production gets its database from
 * the install path / an external managed DB, never this dev helper.
 */

const logger = createLogger("ops:ensure-postgres-dev");

const CONTAINER_NAME = "docklands-dev-postgres";
const POSTGRES_IMAGE =
	process.env.DOCKLANDS_DEV_POSTGRES_IMAGE || "postgres:16";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function tcpReachable(
	host: string,
	port: number,
	timeoutMs = 1500,
): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host, port });
		const done = (ok: boolean) => {
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(timeoutMs);
		socket.on("connect", () => done(true));
		socket.on("timeout", () => done(false));
		socket.on("error", () => done(false));
	});
}

function dockerAvailable(): boolean {
	try {
		execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], {
			stdio: "ignore",
		});
		return true;
	} catch {
		return false;
	}
}

function docker(args: string[]): string {
	return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function containerState(name: string): "running" | "stopped" | "absent" {
	try {
		const running = docker([
			"ps",
			"--filter",
			`name=^/${name}$`,
			"--format",
			"{{.Names}}",
		]);
		if (running === name) {
			return "running";
		}
		const all = docker([
			"ps",
			"-a",
			"--filter",
			`name=^/${name}$`,
			"--format",
			"{{.Names}}",
		]);
		return all === name ? "stopped" : "absent";
	} catch {
		return "absent";
	}
}

async function waitForTcp(host: string, port: number, timeoutMs = 60_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await tcpReachable(host, port)) {
			return true;
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	return false;
}

async function main() {
	if (process.env.NODE_ENV === "production") {
		logger.error(
			"ensure-postgres-dev is a Local-mode helper and must not run under NODE_ENV=production",
		);
		process.exit(1);
	}

	const target = resolvePostgresTargetFromUrl(dbUrl);
	const parsed = new URL(dbUrl);
	const password = decodeURIComponent(parsed.password);

	if (await tcpReachable(target.host, target.port)) {
		logger.info(
			{ host: target.host, port: target.port },
			"Postgres already reachable — nothing to provision",
		);
		return;
	}

	const isLoopback = LOOPBACK_HOSTS.has(target.host.toLowerCase());
	if (!isLoopback) {
		logger.fatal(
			{ host: target.host, port: target.port },
			`DATABASE_URL points at a remote host (${target.host}) that is not reachable. ` +
				"Local mode only auto-provisions a loopback Postgres; start that database or fix DATABASE_URL.",
		);
		process.exit(1);
	}

	if (!dockerAvailable()) {
		logger.fatal(
			"No Postgres is listening and Docker is not available to provision one. " +
				`Start Postgres at ${target.host}:${target.port} (matching apps/docklands/.env), or install/start Docker.`,
		);
		process.exit(1);
	}

	const state = containerState(CONTAINER_NAME);
	if (state === "running") {
		logger.info(
			{ container: CONTAINER_NAME },
			"Dev Postgres container already running",
		);
	} else if (state === "stopped") {
		logger.info(
			{ container: CONTAINER_NAME },
			"Starting existing dev Postgres container",
		);
		docker(["start", CONTAINER_NAME]);
	} else {
		logger.info(
			{ container: CONTAINER_NAME, image: POSTGRES_IMAGE, port: target.port },
			"Creating dev Postgres container",
		);
		docker([
			"run",
			"-d",
			"--name",
			CONTAINER_NAME,
			"--restart",
			"unless-stopped",
			"-p",
			`${target.port}:5432`,
			"-e",
			`POSTGRES_USER=${target.user}`,
			"-e",
			`POSTGRES_PASSWORD=${password}`,
			"-e",
			`POSTGRES_DB=${target.database}`,
			"-v",
			"docklands-dev-postgres-data:/var/lib/postgresql/data",
			POSTGRES_IMAGE,
		]);
	}

	if (!(await waitForTcp(target.host, target.port))) {
		logger.fatal(
			{ host: target.host, port: target.port, container: CONTAINER_NAME },
			"Provisioned dev Postgres did not start accepting connections in time. " +
				`Inspect it with: docker logs ${CONTAINER_NAME}`,
		);
		process.exit(1);
	}

	// Plain stdout — developer-facing confirmation banner.
	console.log(
		`Local Postgres ready (container ${CONTAINER_NAME}) at ${target.host}:${target.port}`,
	);
}

main().catch((err) => {
	logger.fatal({ err }, "Failed to ensure Local-mode Postgres");
	process.exit(1);
});
