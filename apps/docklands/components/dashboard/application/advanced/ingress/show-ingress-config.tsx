import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { File, Loader2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";
import { UpdateIngressConfig } from "./update-ingress-config";

interface Props {
	applicationId: string;
}

export const ShowIngressConfig = ({ applicationId }: Props) => {
	const { data: permissions } = api.user.getPermissions.useQuery();
	const canRead = permissions?.traefikFiles.read ?? false;
	const { data, isPending } = api.application.readTraefikConfig.useQuery(
		{
			applicationId,
		},
		{ enabled: !!applicationId && canRead },
	);

	if (!canRead) return null;

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row justify-between">
				<div>
					<h3 className="text-xl font-semibold">Ingress Config</h3>
					<p>
						Modify the service ingress config. Use this only when you need
						specific routing behavior, because invalid config can break ingress
						for this application.
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-4">
				{isPending ? (
					<span className="text-base text-kumo-subtle flex flex-row gap-3 items-center justify-center min-h-[10vh]">
						Loading...
						<Loader2 className="animate-spin" />
					</span>
				) : !data ? (
					<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
						<File className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle">
							No ingress config detected
						</span>
					</div>
				) : (
					<div className="flex flex-col pt-2 relative">
						<div className="flex flex-col gap-6 max-h-[35rem] min-h-[10rem] overflow-y-auto">
							<CodeEditor
								lineWrapping
								value={data || "Empty"}
								disabled
								className="font-mono"
							/>
							<div className="flex justify-end absolute z-50 right-6 top-6">
								<UpdateIngressConfig applicationId={applicationId} />
							</div>
						</div>
					</div>
				)}
			</div>
		</LayerCard>
	);
};
