import copy from "copy-to-clipboard";
import { CopyIcon, Loader2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";

interface Props {
	runtimeWorkerId?: string;
}

export const AddClusterWorker = ({ runtimeWorkerId }: Props) => {
	const { data, isPending, error, isError } = api.cluster.addWorker.useQuery({
		runtimeWorkerId,
	});

	return (
		<div className="sm:max-w-4xl   flex flex-col gap-4 px-0">
			<Dialog.Header>
				<Dialog.Title>Add Cluster Worker</Dialog.Title>
				<Dialog.Description>
					Add a worker machine to the cluster runtime.
				</Dialog.Description>
			</Dialog.Header>
			{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
			{isPending ? (
				<Loader2 className="w-full animate-spin text-kumo-subtle" />
			) : (
				<>
					<div className="flex flex-col gap-2.5 text-sm">
						<span>1. Go to the new machine and run this command</span>
						<span className="bg-kumo-fill rounded-lg p-2 flex justify-between">
							curl https://get.docker.com | sh -s -- --version {data?.version}
							<button
								type="button"
								aria-label="Copy Docker install command"
								className="self-center"
								onClick={() => {
									copy(
										`curl https://get.docker.com | sh -s -- --version ${data?.version}`,
									);
									toast.success("Copied to clipboard");
								}}
							>
								<CopyIcon className="h-4 w-4 cursor-pointer" />
							</button>
						</span>
					</div>

					<div className="flex flex-col gap-2.5 text-sm">
						<span>
							2. Run this command to join the machine as a cluster worker
						</span>

						<span className="bg-kumo-fill rounded-lg p-2  flex">
							{data?.command}
							<button
								type="button"
								aria-label="Copy worker join command"
								className="self-start"
								onClick={() => {
									copy(data?.command || "");
									toast.success("Copied to clipboard");
								}}
							>
								<CopyIcon className="h-4 w-4 cursor-pointer" />
							</button>
						</span>
					</div>
				</>
			)}
		</div>
	);
};
