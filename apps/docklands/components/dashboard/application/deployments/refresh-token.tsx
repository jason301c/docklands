import { Dialog } from "@cloudflare/kumo/components/dialog";
import { RefreshCcw } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type: "application" | "compose";
}
export const RefreshToken = ({ id, type }: Props) => {
	const { mutateAsync } =
		type === "application"
			? api.application.refreshToken.useMutation()
			: api.compose.refreshToken.useMutation();
	const utils = api.useUtils();
	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger>
				<RefreshCcw className="h-4 w-4 cursor-pointer text-kumo-subtle" />
			</Dialog.Trigger>
			<Dialog>
				<div>
					<Dialog.Title>Are you absolutely sure?</Dialog.Title>
					<Dialog.Description>
						This action cannot be undone. This will change the refresh token and
						other tokens will be invalidated.
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
									if (type === "application") {
										utils.application.one.invalidate({
											applicationId: id,
										});
									} else {
										utils.compose.one.invalidate({
											composeId: id,
										});
									}
									toast.success("Refresh updated");
								})
								.catch((err) => {
									logger.error("Failed to update refresh token", err);
									toast.error("Error updating the refresh token");
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
