import { RefreshCcw } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type: "application" | "compose";
}
export const RefreshToken = ({ id, type }: Props) => {
	const applicationRefreshToken = api.application.refreshToken.useMutation();
	const composeRefreshToken = api.compose.refreshToken.useMutation();
	const { mutateAsync } =
		type === "application" ? applicationRefreshToken : composeRefreshToken;
	const utils = api.useUtils();
	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger>
				<RefreshCcw className="h-4 w-4 cursor-pointer text-kumo-subtle" />
			</Dialog.Trigger>
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>Are you absolutely sure?</Dialog.Title>
					<Dialog.Description>
						This action cannot be undone. This will change the refresh token and
						other tokens will be invalidated.
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
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
