import type { CreateServiceOptions } from "dockerode";
import { createLogger } from "@/server/core/lib/logger";
import { docker } from "../constants";
import { pullImage } from "../utils/docker/utils";

const logger = createLogger("setup:postgres");

// Derive the bundled Postgres credentials from the app's own DATABASE_URL rather
// than a hardcoded source-visible password (R4): the container then always uses
// exactly the credentials the app connects with, and there is no shared secret
// baked into the repo. (postgres only honors POSTGRES_PASSWORD on first-init of an
// empty data volume, so this changes nothing for an existing volume; for a fresh
// one it adopts whatever the operator set in DATABASE_URL.)
const resolveBundledPostgresCredentials = () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error(
			"DATABASE_URL must be set to provision the bundled Postgres container.",
		);
	}
	let url: URL;
	try {
		url = new URL(databaseUrl);
	} catch {
		throw new Error("DATABASE_URL is not a valid connection URL.");
	}
	const user = decodeURIComponent(url.username) || "docklands";
	const password = decodeURIComponent(url.password);
	const database = url.pathname.replace(/^\//, "") || "docklands";
	if (!password) {
		throw new Error(
			"DATABASE_URL must include a password to provision the bundled Postgres.",
		);
	}
	return { user, password, database };
};

export const initializePostgres = async () => {
	const imageName = "postgres:16";
	const containerName = "docklands-postgres";
	const { user, password, database } = resolveBundledPostgresCredentials();
	const settings: CreateServiceOptions = {
		Name: containerName,
		TaskTemplate: {
			ContainerSpec: {
				Image: imageName,
				Env: [
					`POSTGRES_USER=${user}`,
					`POSTGRES_DB=${database}`,
					`POSTGRES_PASSWORD=${password}`,
				],
				Mounts: [
					{
						Type: "volume",
						Source: "docklands-postgres",
						Target: "/var/lib/postgresql/data",
					},
				],
			},
			Networks: [{ Target: "docklands-network" }],
			Placement: {
				Constraints: ["node.role==manager"],
			},
		},
		Mode: {
			Replicated: {
				Replicas: 1,
			},
		},
		...(process.env.NODE_ENV === "development" && {
			EndpointSpec: {
				Ports: [
					{
						TargetPort: 5432,
						PublishedPort: 5432,
						Protocol: "tcp",
						PublishMode: "host",
					},
				],
			},
		}),
	};
	try {
		await pullImage(imageName);

		const service = docker.getService(containerName);
		let inspect: Awaited<ReturnType<typeof service.inspect>>;
		try {
			inspect = await service.inspect();
		} catch (inspectErr) {
			// Service not found is the expected path — fall through to create.
			// Log unexpected errors (e.g. Docker daemon unreachable) at debug so
			// they are visible without causing noise on first-run.
			logger.debug(
				{ err: inspectErr },
				"Postgres service inspect failed — treating as not found",
			);
			throw inspectErr;
		}
		await service.update({
			version: Number.parseInt(inspect.Version.Index, 10),
			...settings,
		});
		logger.info({ image: imageName }, "Postgres service updated");
	} catch (_) {
		try {
			await docker.createService(settings);
		} catch (error: any) {
			if (error?.statusCode !== 409) {
				throw error;
			}
			logger.info("Postgres service already exists, continuing");
		}
		logger.info({ image: imageName }, "Postgres service started");
	}
};
