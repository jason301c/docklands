import { Button } from "@cloudflare/kumo/components/button";
import { Ban } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
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
				<Dialog.Header>
					<Dialog.Title>
						Are you sure you want to cancel queued builds?
					</Dialog.Title>
					<Dialog.Description>
						This will cancel all queued builds for this service.
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
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
