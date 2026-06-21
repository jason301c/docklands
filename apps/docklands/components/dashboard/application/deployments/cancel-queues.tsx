import { Ban } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";

interface Props {
	id: string;
	type: "application" | "compose";
}

export const CancelQueues = ({ id, type }: Props) => {
	const { mutateAsync, isPending } =
		type === "application"
			? api.application.cleanQueues.useMutation()
			: api.compose.cleanQueues.useMutation();
	const { data: isCloud } = api.settings.isCloud.useQuery();

	if (isCloud) {
		return null;
	}

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger render={(

				<Button variant="destructive" className="w-fit" loading={isPending}>
					Cancel Queues
					<Ban className="size-4" />
				</Button>
			
)} />
			<Dialog>
				<div>
					<Dialog.Title>
						Are you sure to cancel the incoming deployments?
					</Dialog.Title>
					<Dialog.Description>
						This will cancel all the incoming deployments
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
									toast.success("Queues are being cleaned");
								})
								.catch((err) => {
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
