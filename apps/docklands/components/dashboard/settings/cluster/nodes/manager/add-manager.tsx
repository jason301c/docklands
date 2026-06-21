import copy from "copy-to-clipboard";
import { CopyIcon, Loader2 } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Dialog } from "@cloudflare/kumo/components/dialog";

interface Props {
	serverId?: string;
}

export const AddManager = ({ serverId }: Props) => {
	const { data, isPending, error, isError } = api.cluster.addManager.useQuery({
		serverId,
	});

	return (
		<>
			<div className="sm:max-w-4xl  flex flex-col gap-4 px-0">
				<div>
					<Dialog.Title>Add a new manager</Dialog.Title>
					<Dialog.Description>Add a new manager</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				{isPending ? (
					<Loader2 className="w-full animate-spin text-muted-foreground" />
				) : (
					<>
						<div className="flex flex-col gap-2.5 text-sm">
							<span>
								1. Go to your new server and run the following command
							</span>
							<span className="bg-muted rounded-lg p-2 flex justify-between">
								curl https://get.docker.com | sh -s -- --version {data?.version}
								<button
									type="button"
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
								2. Run the following command to add the node(manager) to your
								cluster
							</span>

							<span className="bg-muted rounded-lg p-2  flex">
								{data?.command}
								<button
									type="button"
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
		</>
	);
};
