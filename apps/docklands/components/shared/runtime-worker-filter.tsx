import { Badge } from "@cloudflare/kumo/components/badge";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Loader2, ServerIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { api } from "@/client/api/trpc";

const LOCAL_RUNTIME_WORKER = "docklands-local-runtime";

interface Props {
	children: (runtimeWorkerId?: string) => ReactNode;
}

export const RuntimeWorkerFilter = ({ children }: Props) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? "/dashboard/workspace";
	const { data: runtimeWorkers, isLoading: isLoadingRuntimeWorkers } =
		api.runtimeWorker.withSSHKey.useQuery();

	const queryRuntimeWorkerId =
		searchParams?.get("runtimeWorkerId") ?? undefined;

	const selectedRuntimeWorker = runtimeWorkers?.find(
		(runtimeWorker) => runtimeWorker.runtimeWorkerId === queryRuntimeWorkerId,
	);
	const runtimeWorkerId = selectedRuntimeWorker
		? selectedRuntimeWorker.runtimeWorkerId
		: undefined;

	const setRuntimeWorkerId = (value: string) => {
		const query = new URLSearchParams(searchParams?.toString() ?? "");
		query.delete("runtimeWorkerId");
		if (value === LOCAL_RUNTIME_WORKER) {
			query.delete("runtimeWorkerId");
		} else {
			query.set("runtimeWorkerId", value);
		}
		const suffix = query.toString();
		router.replace(suffix ? `${currentPathname}?${suffix}` : currentPathname, {
			scroll: false,
		});
	};

	if (isLoadingRuntimeWorkers) {
		return (
			<div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-2 rounded-lg border bg-kumo-canvas">
				<span className="text-lg font-medium text-kumo-subtle">Loading...</span>
				<Loader2 className="size-8 animate-spin text-kumo-subtle" />
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col gap-4">
			{!!runtimeWorkers?.length && (
				<div className="flex w-full items-center justify-end gap-3">
					<Label
						htmlFor="runtime-worker-filter"
						className="whitespace-nowrap text-sm text-kumo-subtle"
					>
						Runtime worker
					</Label>
					<Select
						aria-label="Runtime worker filter"
						value={runtimeWorkerId ?? LOCAL_RUNTIME_WORKER}
						onValueChange={(value) =>
							value !== null && setRuntimeWorkerId(value as never)
						}
					>
						<>
							<div className="flex items-center gap-2">
								<ServerIcon className="size-4 text-kumo-subtle" />
							</div>
						</>
						<>
							<Select.Group>
								<Select.GroupLabel>Runtime workers</Select.GroupLabel>
								<Select.Option value={LOCAL_RUNTIME_WORKER}>
									<div className="flex items-center gap-2">
										<span>Local runtime worker</span>
										<Badge
											variant="secondary"
											className="text-[10px] px-1.5 py-0"
										>
											Local
										</Badge>
									</div>
								</Select.Option>
								{runtimeWorkers.map((runtimeWorker) => (
									<Select.Option
										key={runtimeWorker.runtimeWorkerId}
										value={runtimeWorker.runtimeWorkerId}
									>
										<div className="flex items-center gap-2">
											<span>{runtimeWorker.name}</span>
											<span className="text-xs text-kumo-subtle">
												{runtimeWorker.ipAddress}
											</span>
										</div>
									</Select.Option>
								))}
							</Select.Group>
						</>
					</Select>
				</div>
			)}
			<Fragment key={runtimeWorkerId ?? LOCAL_RUNTIME_WORKER}>
				{children(runtimeWorkerId)}
			</Fragment>
		</div>
	);
};
