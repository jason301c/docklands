import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";

interface Props {
	containerId: string;
	serverId?: string;
}

export const RemoveContainerDialog = ({ containerId, serverId }: Props) => {
	const utils = api.useUtils();
	const { mutateAsync, isPending } = api.docker.removeContainer.useMutation();

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger render={(

				<DropdownMenu.Item
					className="w-full cursor-pointer text-red-500 hover:!text-red-600"
					onSelect={(e) => e.preventDefault()}
				>
					Remove Container
				</DropdownMenu.Item>
			
)} />
			<Dialog>
				<div>
					<Dialog.Title>Are you sure?</Dialog.Title>
					<Dialog.Description>
						This will permanently remove the container{" "}
						<span className="font-semibold">{containerId}</span>. If the
						container is running, it will be forcefully stopped and removed.
						This action cannot be undone.
					</Dialog.Description>
				</div>
				<div>
					<Dialog.Close>Cancel</Dialog.Close>
					<Dialog.Close
						disabled={isPending}
						onClick={async () => {
							await mutateAsync({ containerId, serverId })
								.then(async () => {
									toast.success("Container removed successfully");
									await utils.docker.getContainers.invalidate();
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
