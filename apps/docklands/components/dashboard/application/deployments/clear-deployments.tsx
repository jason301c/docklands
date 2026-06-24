import { Button } from "@cloudflare/kumo/components/button";
import { Paintbrush } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type: "application" | "compose";
}

export const ClearDeployments = ({ id, type }: Props) => {
	const utils = api.useUtils();
	const applicationClearDeployments =
		api.application.clearDeployments.useMutation();
	const composeClearDeployments = api.compose.clearDeployments.useMutation();
	const { mutateAsync, isPending } =
		type === "application"
			? applicationClearDeployments
			: composeClearDeployments;

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger
				render={
					<Button variant="outline" className="w-fit" loading={isPending}>
						Clear build records
						<Paintbrush className="size-4" />
					</Button>
				}
			/>
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>
						Are you sure you want to clear old build records?
					</Dialog.Title>
					<Dialog.Description>
						This will delete all old build records and logs, keeping only the
						active build (the most recent successful one).
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Dialog.Close>Cancel</Dialog.Close>
					<Dialog.Close
						onClick={async () => {
							await mutateAsync({
								applicationId: id || "",
								composeId: id || "",
							})
								.then(async () => {
									toast.success("Old build records cleared successfully");
									await utils.deployment.allByType.invalidate({
										id,
										type: type as "application" | "compose",
									});
								})
								.catch((err) => {
									logger.error("Failed to clear deployments", err);
									toast.error(err.message);
								});
						}}
					>
						Confirm
					</Dialog.Close>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
