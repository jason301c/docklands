import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Scissors } from "lucide-react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

interface Props {
	id: string;
	type: "application" | "compose";
}

export const KillBuild = ({ id, type }: Props) => {
	const { mutateAsync, isPending } =
		type === "application"
			? api.application.killBuild.useMutation()
			: api.compose.killBuild.useMutation();

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
				<div>
					<Dialog.Title>Are you sure to kill the build?</Dialog.Title>
					<Dialog.Description>
						This will kill the build process
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
									toast.success("Build killed successfully");
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
