import type { CreateServiceOptions } from "dockerode";
import { createLogger } from "@/server/core/lib/logger";
import { docker } from "../constants";
import { pullImage } from "../utils/docker/utils";

const logger = createLogger("setup:postgres");

export const initializePostgres = async () => {
	const imageName = "postgres:16";
	const containerName = "docklands-postgres";
	const settings: CreateServiceOptions = {
		Name: containerName,
		TaskTemplate: {
			ContainerSpec: {
				Image: imageName,
				Env: [
					"POSTGRES_USER=docklands",
					"POSTGRES_DB=docklands",
					"POSTGRES_PASSWORD=amukds4wi9001583845717ad2",
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
