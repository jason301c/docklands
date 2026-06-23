import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Ban } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type: "application" | "compose";
}

export const CancelQueues = ({ id, type }: Props) => {
	const applicationCleanQueues = api.application.cleanQueues.useMutation();
	const composeCleanQueues = api.compose.cleanQueues.useMutation();
	const { mutateAsync, isPending } =
		type === "application" ? applicationCleanQueues : composeCleanQueues;

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger
				render={
					<Button variant="destructive" className="w-fit" loading={isPending}>
						Cancel Queued Builds
						<Ban className="size-4" />
					</Button>
				}
			/>
			<Dialog>
				<div>
					<Dialog.Title>
						Are you sure you want to cancel queued builds?
					</Dialog.Title>
					<Dialog.Description>
						This will cancel all queued builds for this service.
					</Dialog.Description>
				</div>
				<div>
					<Dialog.Close>Cancel</Dialog.Close>
					<Dialog.Close
						onClick={async () => {
							await mutateAsync({
								applicationId: id || "",
								composeId: id || "",
							})
								.then(() => {
									toast.success("Queued builds are being cancelled");
								})
								.catch((err) => {
									logger.error("Failed to cancel queued builds", err);
									toast.error(err.message);
								});
						}}
					>
						Confirm
					</Dialog.Close>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
