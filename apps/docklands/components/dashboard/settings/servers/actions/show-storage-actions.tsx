import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";

interface Props {
	serverId?: string;
}
export const ShowStorageActions = ({ serverId }: Props) => {
	const { mutateAsync: cleanAll, isPending: cleanAllIsLoading } =
		api.settings.cleanAll.useMutation();

	const {
		mutateAsync: cleanDockerBuilder,
		isPending: cleanDockerBuilderIsPending,
	} = api.settings.cleanDockerBuilder.useMutation();

	const { mutateAsync: cleanMonitoring } =
		api.settings.cleanMonitoring.useMutation();
	const {
		mutateAsync: cleanUnusedImages,
		isPending: cleanUnusedImagesIsPending,
	} = api.settings.cleanUnusedImages.useMutation();

	const {
		mutateAsync: cleanUnusedVolumes,
		isPending: cleanUnusedVolumesIsPending,
	} = api.settings.cleanUnusedVolumes.useMutation();

	const {
		mutateAsync: cleanStoppedContainers,
		isPending: cleanStoppedContainersIsPending,
	} = api.settings.cleanStoppedContainers.useMutation();

	const { mutateAsync: cleanPatchRepos, isPending: cleanPatchReposIsLoading } =
		api.patch.cleanPatchRepos.useMutation();

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				disabled={
					cleanAllIsLoading ||
					cleanDockerBuilderIsPending ||
					cleanUnusedImagesIsPending ||
					cleanUnusedVolumesIsPending ||
					cleanStoppedContainersIsPending ||
					cleanPatchReposIsLoading
				}
				render={
					<Button
						loading={
							cleanAllIsLoading ||
							cleanDockerBuilderIsPending ||
							cleanUnusedImagesIsPending ||
							cleanUnusedVolumesIsPending ||
							cleanStoppedContainersIsPending ||
							cleanPatchReposIsLoading
						}
						variant="outline"
					>
						Storage
					</Button>
				}
			/>
			<DropdownMenu.Content className="w-64" align="start">
				<DropdownMenu.Label>Actions</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanUnusedImages({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Cleaned images");
								})
								.catch(() => {
									toast.error("Error cleaning images");
								});
						}}
					>
						<span>Clean unused images</span>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanUnusedVolumes({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Cleaned volumes");
								})
								.catch(() => {
									toast.error("Error cleaning volumes");
								});
						}}
					>
						<span>Clean unused volumes</span>
					</DropdownMenu.Item>

					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanStoppedContainers({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Stopped containers cleaned");
								})
								.catch(() => {
									toast.error("Error cleaning stopped containers");
								});
						}}
					>
						<span>Clean stopped containers</span>
					</DropdownMenu.Item>

					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanPatchRepos({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Cleaned Patch Caches");
								})
								.catch(() => {
									toast.error("Error cleaning Patch Caches");
								});
						}}
					>
						<span>Clean Patch Caches</span>
					</DropdownMenu.Item>

					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanDockerBuilder({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Cleaned build cache");
								})
								.catch(() => {
									toast.error("Error cleaning build cache");
								});
						}}
					>
						<span>Clean Build Cache & Runtime</span>
					</DropdownMenu.Item>
					{!serverId && (
						<DropdownMenu.Item
							className="w-full cursor-pointer"
							onClick={async () => {
								await cleanMonitoring()
									.then(async () => {
										toast.success("Cleaned metrics");
									})
									.catch(() => {
										toast.error("Error cleaning metrics");
									});
							}}
						>
							<span>Clean metrics</span>
						</DropdownMenu.Item>
					)}

					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onClick={async () => {
							await cleanAll({
								serverId: serverId,
							})
								.then(async () => {
									toast.success("Cleaning in progress... Please wait");
								})
								.catch(() => {
									toast.error("Error cleaning all");
								});
						}}
					>
						<span>Clean all</span>
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
