import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Ban } from "lucide-react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

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
