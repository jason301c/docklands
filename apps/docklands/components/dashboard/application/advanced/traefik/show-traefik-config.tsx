import { File, Loader2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { UpdateTraefikConfig } from "./update-traefik-config";

interface Props {
	applicationId: string;
}

export const ShowTraefikConfig = ({ applicationId }: Props) => {
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
		<LayerCard className="bg-background">
			<div className="flex flex-row justify-between">
				<div>
					<h3 className="text-xl">Traefik</h3>
					<p>
						Modify the traefik config, in rare cases you may need to add
						specific config, be careful because modifying incorrectly can break
						traefik and your application
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-4">
				{isPending ? (
					<span className="text-base text-muted-foreground flex flex-row gap-3 items-center justify-center min-h-[10vh]">
						Loading...
						<Loader2 className="animate-spin" />
					</span>
				) : !data ? (
					<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
						<File className="size-8 text-muted-foreground" />
						<span className="text-base text-muted-foreground">
							No traefik config detected
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
								<UpdateTraefikConfig applicationId={applicationId} />
							</div>
						</div>
					</div>
				)}
			</div>
		</LayerCard>
	);
};
