"use client";

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { createClientLogger } from "@/client/lib/logger";

const logger = createClientLogger("metrics");

import { Meter } from "@cloudflare/kumo/components/meter";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { DockerBlockChart } from "./docker-block-chart";
import { DockerCpuChart } from "./docker-cpu-chart";
import { DockerDiskChart } from "./docker-disk-chart";
import { DockerDiskUsageChart } from "./docker-disk-usage-chart";
import { DockerMemoryChart } from "./docker-memory-chart";
import { DockerNetworkChart } from "./docker-network-chart";

const defaultData = {
	cpu: {
		value: "0%",
		time: "",
	},
	memory: {
		value: {
			used: 0,
			total: 0,
		},
		time: "",
	},
	block: {
		value: {
			readMb: 0,
			writeMb: 0,
		},
		time: "",
	},
	network: {
		value: {
			inputMb: 0,
			outputMb: 0,
		},
		time: "",
	},
	disk: {
		value: { diskTotal: 0, diskUsage: 0, diskUsedPercentage: 0, diskFree: 0 },
		time: "",
	},
};

interface Props {
	appName: string;
	appType?: "application" | "stack" | "docker-compose";
}
export interface DockerStats {
	cpu: {
		value: string;
		time: string;
	};
	memory: {
		value: {
			used: number;
			total: number;
		};
		time: string;
	};
	block: {
		value: {
			readMb: number;
			writeMb: number;
		};
		time: string;
	};
	network: {
		value: {
			inputMb: number;
			outputMb: number;
		};
		time: string;
	};
	disk: {
		value: {
			diskTotal: number;
			diskUsage: number;
			diskUsedPercentage: number;
			diskFree: number;
		};

		time: string;
	};
}

export type DockerStatsJSON = {
	cpu: DockerStats["cpu"][];
	memory: DockerStats["memory"][];
	block: DockerStats["block"][];
	network: DockerStats["network"][];
	disk: DockerStats["disk"][];
};

export const convertMemoryToBytes = (
	memoryString: string | undefined,
): number => {
	if (!memoryString || typeof memoryString !== "string") {
		return 0;
	}

	const value = Number.parseFloat(memoryString) || 0;
	const unit = memoryString.replace(/[0-9.]/g, "").trim();

	switch (unit) {
		case "KiB":
			return value * 1024;
		case "MiB":
			return value * 1024 * 1024;
		case "GiB":
			return value * 1024 * 1024 * 1024;
		case "TiB":
			return value * 1024 * 1024 * 1024 * 1024;
		default:
			return value;
	}
};

export const ContainerFreeMonitoring = ({
	appName,
	appType = "application",
}: Props) => {
	const { data } = api.application.readAppMonitoring.useQuery(
		{ appName },
		{
			refetchOnWindowFocus: false,
		},
	);
	const [accumulativeData, setAccumulativeData] = useState<DockerStatsJSON>({
		cpu: [],
		memory: [],
		block: [],
		network: [],
		disk: [],
	});
	const [currentData, setCurrentData] = useState<DockerStats>(defaultData);

	useEffect(() => {
		setCurrentData(defaultData);

		setAccumulativeData({
			cpu: [],
			memory: [],
			block: [],
			network: [],
			disk: [],
		});
	}, [appName]);

	useEffect(() => {
		if (!data) return;

		setCurrentData({
			cpu: data.cpu[data.cpu.length - 1] ?? currentData.cpu,
			memory: data.memory[data.memory.length - 1] ?? currentData.memory,
			block: data.block[data.block.length - 1] ?? currentData.block,
			network: data.network[data.network.length - 1] ?? currentData.network,
			disk: data.disk[data.disk.length - 1] ?? currentData.disk,
		});
		setAccumulativeData({
			block: data?.block || [],
			cpu: data?.cpu || [],
			disk: data?.disk || [],
			memory: data?.memory || [],
			network: data?.network || [],
		});
	}, [data]);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/listen-docker-stats-monitoring?appName=${appName}&appType=${appType}`;
		const ws = new WebSocket(wsUrl);

		ws.onmessage = (e) => {
			const value = JSON.parse(e.data);
			if (!value) return;

			const data = {
				cpu: value.data.cpu ?? currentData.cpu,
				memory: value.data.memory ?? currentData.memory,
				block: value.data.block ?? currentData.block,
				disk: value.data.disk ?? currentData.disk,
				network: value.data.network ?? currentData.network,
			};

			setCurrentData(data);

			const MAX_DATA_POINTS = 300;
			setAccumulativeData((prevData) => ({
				cpu: [...prevData.cpu, data.cpu].slice(-MAX_DATA_POINTS),
				memory: [...prevData.memory, data.memory].slice(-MAX_DATA_POINTS),
				block: [...prevData.block, data.block].slice(-MAX_DATA_POINTS),
				network: [...prevData.network, data.network].slice(-MAX_DATA_POINTS),
				disk: [...prevData.disk, data.disk].slice(-MAX_DATA_POINTS),
			}));
		};

		ws.onclose = (e) => {
			logger.debug("monitoring WS closed:", e.reason);
		};

		return () => ws.close();
	}, [appName]);

	return (
		<div className="rounded-xl bg-kumo-canvas flex flex-col gap-4">
			<header className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
					<p className="text-sm text-kumo-subtle">
						Watch runtime usage for this service
					</p>
				</div>
			</header>

			<div className="grid gap-6 lg:grid-cols-2">
				<LayerCard className="bg-kumo-canvas">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h3 className="text-sm font-medium">CPU Usage</h3>
					</div>
					<div>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-kumo-subtle">
								Used: {String(currentData.cpu.value ?? "0%")}
							</span>
							<Meter
								label="CPU usage"
								showValue={false}
								value={Number.parseInt(
									String(currentData.cpu.value ?? "0%").replace("%", ""),
									10,
								)}
								className="w-[100%]"
							/>
							<DockerCpuChart accumulativeData={accumulativeData.cpu} />
						</div>
					</div>
				</LayerCard>
				<LayerCard className="bg-kumo-canvas">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h3 className="text-sm font-medium">Memory Usage</h3>
					</div>
					<div>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-kumo-subtle">
								{`Used:  ${currentData.memory.value.used} / Limit: ${currentData.memory.value.total} `}
							</span>
							<Meter
								label="Memory usage"
								showValue={false}
								value={
									// @ts-expect-error
									(convertMemoryToBytes(currentData.memory.value.used) /
										// @ts-expect-error
										convertMemoryToBytes(currentData.memory.value.total)) *
									100
								}
								className="w-[100%]"
							/>
							<DockerMemoryChart
								accumulativeData={accumulativeData.memory}
								memoryLimitGB={
									// @ts-expect-error
									convertMemoryToBytes(currentData.memory.value.total) /
									1024 ** 3
								}
							/>
						</div>
					</div>
				</LayerCard>
				{appName === "docklands" && (
					<LayerCard className="bg-kumo-canvas">
						<div className="flex flex-row items-center justify-between space-y-0 pb-2">
							<h3 className="text-sm font-medium">Disk Space</h3>
						</div>
						<div>
							<div className="flex flex-col gap-2 w-full">
								<span className="text-sm text-kumo-subtle">
									{`Used:  ${currentData.disk.value.diskUsage} GB / Limit: ${currentData.disk.value.diskTotal} GB`}
								</span>
								<Meter
									label="Disk space"
									showValue={false}
									value={currentData.disk.value.diskUsedPercentage}
									className="w-[100%]"
								/>
								<DockerDiskChart
									accumulativeData={accumulativeData.disk}
									diskTotal={currentData.disk.value.diskTotal}
								/>
							</div>
						</div>
					</LayerCard>
				)}
				{appName === "docklands" && (
					<LayerCard className="bg-kumo-canvas">
						<div className="flex flex-row items-center justify-between space-y-0 pb-2">
							<h3 className="text-sm font-medium">Container Disk Usage</h3>
						</div>
						<div>
							<DockerDiskUsageChart />
						</div>
					</LayerCard>
				)}

				<LayerCard className="bg-kumo-canvas">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h3 className="text-sm font-medium">Block I/O</h3>
					</div>
					<div>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-kumo-subtle">
								{`Read:  ${currentData.block.value.readMb}  / Write: ${currentData.block.value.writeMb} `}
							</span>
							<DockerBlockChart accumulativeData={accumulativeData.block} />
						</div>
					</div>
				</LayerCard>
				<LayerCard className="bg-kumo-canvas">
					<div className="flex flex-row items-center justify-between space-y-0 pb-2">
						<h3 className="text-sm font-medium">Network I/O</h3>
					</div>
					<div>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-kumo-subtle">
								{`In MB: ${currentData.network.value.inputMb}  / Out MB: ${currentData.network.value.outputMb} `}
							</span>
							<DockerNetworkChart accumulativeData={accumulativeData.network} />
						</div>
					</div>
				</LayerCard>
			</div>
		</div>
	);
};
