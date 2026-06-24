import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationNested } from "@/server/core/utils/builders";
import { mechanizeDockerContainer } from "@/server/core/utils/builders";

type MockCreateServiceOptions = {
	TaskTemplate?: {
		ContainerSpec?: {
			StopGracePeriod?: number;
			Ulimits?: Array<{ Name: string; Soft: number; Hard: number }>;
		};
	};
	[key: string]: unknown;
};

const { inspectMock, getServiceMock, createServiceMock, getRemoteDockerMock } =
	vi.hoisted(() => {
		const inspect = vi.fn<() => Promise<never>>();
		const getService = vi.fn(() => ({ inspect }));
		const createService = vi.fn<
			(opts: MockCreateServiceOptions) => Promise<void>
		>(async () => undefined);
		const getRemoteDocker = vi.fn(async () => ({
			getService,
			createService,
		}));
		return {
			inspectMock: inspect,
			getServiceMock: getService,
			createServiceMock: createService,
			getRemoteDockerMock: getRemoteDocker,
		};
	});

vi.mock("@/server/core/utils/servers/remote-docker", () => ({
	getRemoteDocker: getRemoteDockerMock,
}));

const createApplication = (
	overrides: Partial<ApplicationNested> = {},
): ApplicationNested =>
	({
		appName: "test-app",
		buildType: "dockerfile",
		env: null,
		mounts: [],
		cpuLimit: null,
		memoryLimit: null,
		memoryReservation: null,
		cpuReservation: null,
		command: null,
		ports: [],
		sourceType: "docker",
		dockerImage: "example:latest",
		registry: null,
		environment: {
			workspace: { env: null },
			env: null,
		},
		replicas: 1,
		stopGracePeriodSwarm: 0,
		ulimitsSwarm: null,
		runtimeWorkerId: "runtimeWorker-id",
		...overrides,
	}) as unknown as ApplicationNested;

describe("mechanizeDockerContainer", () => {
	beforeEach(() => {
		inspectMock.mockReset();
		// A missing swarm service surfaces as a 404 from dockerode; that's the only
		// case that should fall through to createService.
		inspectMock.mockRejectedValue(
			Object.assign(new Error("service not found"), { statusCode: 404 }),
		);
		getServiceMock.mockClear();
		createServiceMock.mockClear();
		getRemoteDockerMock.mockClear();
		getRemoteDockerMock.mockResolvedValue({
			getService: getServiceMock,
			createService: createServiceMock,
		});
	});

	it("passes stopGracePeriodSwarm as a number and keeps zero values", async () => {
		const application = createApplication({ stopGracePeriodSwarm: 0 });

		await mechanizeDockerContainer(application);

		expect(createServiceMock).toHaveBeenCalledTimes(1);
		const call = createServiceMock.mock.calls[0] as
			| [MockCreateServiceOptions]
			| undefined;
		if (!call) {
			throw new Error("createServiceMock should have been called once");
		}
		const [settings] = call;
		expect(settings.TaskTemplate?.ContainerSpec?.StopGracePeriod).toBe(0);
		expect(typeof settings.TaskTemplate?.ContainerSpec?.StopGracePeriod).toBe(
			"number",
		);
	});

	it("omits StopGracePeriod when stopGracePeriodSwarm is null", async () => {
		const application = createApplication({ stopGracePeriodSwarm: null });

		await mechanizeDockerContainer(application);

		expect(createServiceMock).toHaveBeenCalledTimes(1);
		const call = createServiceMock.mock.calls[0] as
			| [MockCreateServiceOptions]
			| undefined;
		if (!call) {
			throw new Error("createServiceMock should have been called once");
		}
		const [settings] = call;
		expect(settings.TaskTemplate?.ContainerSpec).not.toHaveProperty(
			"StopGracePeriod",
		);
	});

	it("passes ulimits to ContainerSpec when ulimitsSwarm is defined", async () => {
		const ulimits = [
			{ Name: "nofile", Soft: 10000, Hard: 20000 },
			{ Name: "nproc", Soft: 4096, Hard: 8192 },
		];
		const application = createApplication({ ulimitsSwarm: ulimits });

		await mechanizeDockerContainer(application);

		expect(createServiceMock).toHaveBeenCalledTimes(1);
		const call = createServiceMock.mock.calls[0];
		if (!call) {
			throw new Error("createServiceMock should have been called once");
		}
		const [settings] = call;
		expect(settings.TaskTemplate?.ContainerSpec?.Ulimits).toEqual(ulimits);
	});

	it("omits Ulimits when ulimitsSwarm is null", async () => {
		const application = createApplication({ ulimitsSwarm: null });

		await mechanizeDockerContainer(application);

		expect(createServiceMock).toHaveBeenCalledTimes(1);
		const call = createServiceMock.mock.calls[0];
		if (!call) {
			throw new Error("createServiceMock should have been called once");
		}
		const [settings] = call;
		expect(settings.TaskTemplate?.ContainerSpec).not.toHaveProperty("Ulimits");
	});

	it("omits Ulimits when ulimitsSwarm is an empty array", async () => {
		const application = createApplication({ ulimitsSwarm: [] });

		await mechanizeDockerContainer(application);

		expect(createServiceMock).toHaveBeenCalledTimes(1);
		const call = createServiceMock.mock.calls[0];
		if (!call) {
			throw new Error("createServiceMock should have been called once");
		}
		const [settings] = call;
		expect(settings.TaskTemplate?.ContainerSpec).not.toHaveProperty("Ulimits");
	});

	it("propagates a non-404 inspect error instead of attempting create", async () => {
		// A daemon/transient error (not "service absent") must not be swallowed
		// into a create — that would 409 or mask the real failure.
		inspectMock.mockRejectedValue(
			Object.assign(new Error("daemon unreachable"), { statusCode: 500 }),
		);
		const application = createApplication();

		await expect(mechanizeDockerContainer(application)).rejects.toThrow(
			"daemon unreachable",
		);
		expect(createServiceMock).not.toHaveBeenCalled();
	});
});
