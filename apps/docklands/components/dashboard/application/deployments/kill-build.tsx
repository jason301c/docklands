import { Button } from "@cloudflare/kumo/components/button";
import { Scissors } from "lucide-react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("deployments");

interface Props {
	id: string;
	type: "application" | "compose";
}

export const KillBuild = ({ id, type }: Props) => {
	const applicationKillBuild = api.application.killBuild.useMutation();
	const composeKillBuild = api.compose.killBuild.useMutation();
	const { mutateAsync, isPending } =
		type === "application" ? applicationKillBuild : composeKillBuild;

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger
				render={
					<Button variant="outline" className="w-fit" loading={isPending}>
						Kill Build
						<Scissors className="size-4" />
					</Button>
				}
			/>
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>Are you sure to kill the build?</Dialog.Title>
					<Dialog.Description>
						This will kill the build process
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
									toast.success("Build killed successfully");
								})
								.catch((err) => {
									logger.error("Failed to kill build", err);
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
