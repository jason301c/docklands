import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { api } from "@/client/api/trpc";
import { ComposeActions } from "./actions";
import { ShowProviderFormCompose } from "./generic/show";

interface Props {
	composeId: string;
}

export const ShowGeneralCompose = ({ composeId }: Props) => {
	const { data } = api.compose.one.useQuery(
		{ composeId },
		{
			enabled: !!composeId,
		},
	);

	return (
		<>
			<LayerCard className="bg-kumo-canvas">
				<div>
					<div className="flex flex-row gap-2 justify-between flex-wrap">
						<h3 className="text-xl font-semibold">Build Settings</h3>
						<Badge>
							{data?.composeType === "docker-compose" ? "Compose" : "Stack"}
						</Badge>
					</div>

					<p>Create a compose file to build your compose service.</p>
				</div>
				<div className="flex flex-col gap-4 flex-wrap">
					<ComposeActions composeId={composeId} />
				</div>
			</LayerCard>
			<ShowProviderFormCompose composeId={composeId} />
		</>
	);
};
