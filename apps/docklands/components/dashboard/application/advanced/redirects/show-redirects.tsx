import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Split, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleRedirect } from "./handle-redirect";

const logger = createClientLogger("application");

interface Props {
	applicationId: string;
}

export const ShowRedirects = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{
			applicationId,
		},
		{ enabled: !!applicationId },
	);

	const { mutateAsync: deleteRedirect, isPending: isRemoving } =
		api.redirects.delete.useMutation();

	const utils = api.useUtils();

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-row justify-between flex-wrap gap-4">
				<div>
					<h3 className="text-xl font-semibold">Redirects</h3>
					<p>
						If you want to redirect requests to this application use the
						following config to setup the redirects
					</p>
				</div>

				{data && data?.redirects.length > 0 && (
					<HandleRedirect applicationId={applicationId}>
						Add Redirect
					</HandleRedirect>
				)}
			</div>
			<div className="flex flex-col gap-4">
				{data?.redirects.length === 0 ? (
					<div className="flex w-full flex-col items-center justify-center gap-3 pt-10">
						<Split className="size-8 text-kumo-subtle" />
						<span className="text-base text-kumo-subtle">
							No redirects configured
						</span>
						<HandleRedirect applicationId={applicationId}>
							Add Redirect
						</HandleRedirect>
					</div>
				) : (
					<div className="flex flex-col pt-2">
						<div className="flex flex-col gap-6">
							{data?.redirects.map((redirect) => (
								<div key={redirect.redirectId}>
									<div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-10 border rounded-lg p-4">
										<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 flex-col gap-4 sm:gap-8">
											<div className="flex flex-col gap-1">
												<span className="font-medium">Regex</span>
												<span className="text-sm text-kumo-subtle">
													{redirect.regex}
												</span>
											</div>
											<div className="flex flex-col gap-1">
												<span className="font-medium">Replacement</span>
												<span className="text-sm text-kumo-subtle">
													{redirect.replacement}
												</span>
											</div>
											<div className="flex flex-col gap-1">
												<span className="font-medium">Permanent</span>
												<span className="text-sm text-kumo-subtle">
													{redirect.permanent ? "Yes" : "No"}
												</span>
											</div>
										</div>
										<div className="flex flex-row gap-4">
											<HandleRedirect
												redirectId={redirect.redirectId}
												applicationId={applicationId}
											/>

											<DialogAction
												title="Delete Redirect"
												description="Are you sure you want to delete this redirect?"
												type="destructive"
												onClick={async () => {
													await deleteRedirect({
														redirectId: redirect.redirectId,
													})
														.then(() => {
															refetch();
															utils.application.readTraefikConfig.invalidate({
																applicationId,
															});
															toast.success("Redirect deleted successfully");
														})
														.catch((err) => {
															logger.error("Failed to delete redirect", err);
															toast.error("Error deleting redirect");
														});
												}}
											>
												<Button
													aria-label="Delete redirect"
													variant="ghost"
													shape="square"
													className="group hover:bg-kumo-danger/10"
													loading={isRemoving}
												>
													<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
												</Button>
											</DialogAction>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</LayerCard>
	);
};
