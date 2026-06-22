import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

const MAX_BUILDS_CONCURRENCY = 100;

interface Props {
	/**
	 * When provided, configures concurrency for that remote worker. When
	 * omitted, configures the local Docklands runtime.
	 */
	runtimeWorkerId?: string;
	/** Optional title override (e.g. the worker name in a list). */
	label?: string;
}

/**
 * Control to set the number of concurrent builds, either for a remote worker
 * (`runtimeWorkerId` provided) or the local runtime (omitted). Available to
 * self-hosted instances.
 */
export const BuildsConcurrency = ({ runtimeWorkerId, label }: Props) => {
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const serverQuery = api.runtimeWorker.one.useQuery(
		{ runtimeWorkerId: runtimeWorkerId ?? "" },
		{ enabled: !!runtimeWorkerId },
	);
	const localRuntimeQuery = api.settings.getWebServerSettings.useQuery(
		undefined,
		{
			enabled: !runtimeWorkerId,
		},
	);

	const current = runtimeWorkerId
		? serverQuery.data?.buildsConcurrency
		: localRuntimeQuery.data?.buildsConcurrency;
	const refetch = runtimeWorkerId
		? serverQuery.refetch
		: localRuntimeQuery.refetch;

	const updateServer = api.runtimeWorker.updateBuildsConcurrency.useMutation();
	const updateLocalRuntime = api.settings.updateBuildsConcurrency.useMutation();
	const isPending = runtimeWorkerId
		? updateServer.isPending
		: updateLocalRuntime.isPending;

	const [value, setValue] = useState("1");

	useEffect(() => {
		if (current) {
			setValue(String(current));
		}
	}, [current]);

	// Concurrent builds are a self-hosted feature; not shown in cloud.
	if (isCloud) return null;

	const clamp = (n: number) => Math.min(MAX_BUILDS_CONCURRENCY, Math.max(1, n));

	const handleSave = async () => {
		const parsed = clamp(Number.parseInt(value, 10) || 1);
		setValue(String(parsed));
		try {
			if (runtimeWorkerId) {
				await updateServer.mutateAsync({
					runtimeWorkerId,
					buildsConcurrency: parsed,
				});
			} else {
				await updateLocalRuntime.mutateAsync({ buildsConcurrency: parsed });
			}
			await refetch();
			toast.success("Builds concurrency updated");
		} catch {
			toast.error("Error updating builds concurrency");
		}
	};

	const hasChanges = Number(value) !== (current ?? 1);

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-3">
			<div className="flex flex-row items-center justify-between gap-4">
				<div className="space-y-0.5">
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium">
							{label ?? serverQuery.data?.name ?? "Local runtime worker"}
						</p>
						<span className="text-xs text-kumo-subtle rounded border px-1.5 py-0.5">
							{runtimeWorkerId
								? (serverQuery.data?.ipAddress ?? "remote worker")
								: "local worker"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Input
						aria-label={`${label ?? serverQuery.data?.name ?? "Local runtime worker"} build concurrency`}
						type="number"
						min={1}
						max={MAX_BUILDS_CONCURRENCY}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						className="w-20"
					/>
					<Button
						type="button"
						size="sm"
						onClick={handleSave}
						loading={isPending}
						disabled={!hasChanges}
					>
						Save
					</Button>
				</div>
			</div>
		</div>
	);
};
