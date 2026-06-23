import type { CreateServiceOptions, PortConfig } from "dockerode";
import {
	buildDatabaseContainerCommand,
	buildDatabaseEnv,
	buildDatabasePublishedPorts,
	parseDatabaseConfig,
} from "@/server/core/databases/registry";
import type { InferResultType } from "@/server/core/types/with";
import {
	calculateResources,
	generateBindMounts,
	generateConfigContainer,
	generateFileMounts,
	generateVolumeMounts,
	prepareEnvironmentVariables,
} from "../docker/utils";
import { getRemoteDocker } from "../servers/remote-docker";

export type DatabaseNested = InferResultType<
	"database",
	{ mounts: true; environment: { with: { workspace: true } } }
>;

/**
 * Generic managed-database builder. Replaces the six per-engine builders
 * (buildPostgres/buildMysql/...). All engine-specific behavior — env recipe,
 * container command, published ports, mount path — comes from the engine
 * registry, so adding an engine never touches this file.
 */
export const buildDatabase = async (service: DatabaseNested) => {
	const {
		appName,
		engine,
		env,
		externalPort,
		dockerImage,
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
		command,
		args,
		mounts,
	} = service;

	const config = parseDatabaseConfig(engine, service.config);

	const defaultEnv = buildDatabaseEnv(engine, config, env);
	const containerCommand = buildDatabaseContainerCommand(engine, {
		appName,
		config,
		command,
		args,
	});
	const publishedPorts = buildDatabasePublishedPorts(engine, {
		config,
		externalPort,
	});

	const {
		HealthCheck,
		RestartPolicy,
		Placement,
		Labels,
		Mode,
		RollbackConfig,
		Networks,
		StopGracePeriod,
		EndpointSpec,
		Ulimits,
	} = generateConfigContainer(service);

	const resources = calculateResources({
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
	});
	const envVariables = prepareEnvironmentVariables(
		defaultEnv,
		service.environment.workspace.env,
		service.environment.env,
	);
	const volumesMount = generateVolumeMounts(mounts);
	const bindsMount = generateBindMounts(mounts);
	const filesMount = generateFileMounts(appName, service);

	const docker = await getRemoteDocker(service.runtimeWorkerId);

	const settings: CreateServiceOptions = {
		Name: appName,
		TaskTemplate: {
			ContainerSpec: {
				HealthCheck,
				Image: dockerImage,
				Env: envVariables,
				Mounts: [...volumesMount, ...bindsMount, ...filesMount],
				StopGracePeriod: StopGracePeriod ?? 30_000_000_000,
				...containerCommand,
				...(Ulimits && { Ulimits }),
				Labels,
			},
			Networks,
			RestartPolicy,
			Placement,
			Resources: {
				...resources,
			},
		},
		Mode,
		RollbackConfig,
		EndpointSpec: EndpointSpec
			? EndpointSpec
			: {
					Mode: "dnsrr" as const,
					Ports: publishedPorts.map(
						({ targetPort, publishedPort }): PortConfig => ({
							Protocol: "tcp",
							TargetPort: targetPort,
							PublishedPort: publishedPort,
							PublishMode: "host",
						}),
					),
				},
		UpdateConfig: service.updateConfigSwarm ?? {
			Parallelism: 1,
			Order: "stop-first" as const,
			FailureAction: "rollback" as const,
		},
	};

	try {
		const dockerService = docker.getService(appName);
		const inspect = await dockerService.inspect();
		await dockerService.update({
			version: Number.parseInt(inspect.Version.Index, 10),
			...settings,
			TaskTemplate: {
				...settings.TaskTemplate,
				ForceUpdate: inspect.Spec.TaskTemplate.ForceUpdate + 1,
			},
		});
	} catch (error) {
		console.log("error", error);
		await docker.createService(settings);
	}
};
