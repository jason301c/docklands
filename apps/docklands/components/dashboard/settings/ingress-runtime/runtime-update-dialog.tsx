import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import {
	Bug,
	Download,
	Info,
	RefreshCcw,
	Server,
	Sparkles,
	Stars,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";
import type { IUpdateData } from "@/server/core/services/settings";
import { ApplyRuntimeUpdate } from "./apply-runtime-update";
import { ToggleAutoCheckUpdates } from "./toggle-auto-check-updates";

interface Props {
	updateData?: IUpdateData;
	children?: React.ReactNode;
	isOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export const RuntimeUpdateDialog = ({
	updateData,
	children,
	isOpen: isOpenProp,
	onOpenChange: onOpenChangeProp,
}: Props) => {
	const [hasCheckedUpdate, setHasCheckedUpdate] = useState(!!updateData);
	const [isUpdateAvailable, setIsUpdateAvailable] = useState(
		!!updateData?.updateAvailable,
	);
	const { mutateAsync: getUpdateData, isPending } =
		api.settings.getUpdateData.useMutation();
	const { data: docklandsVersion } =
		api.settings.getDocklandsVersion.useQuery();
	const { data: releaseTag } = api.settings.getReleaseTag.useQuery();
	const [latestVersion, setLatestVersion] = useState(
		updateData?.latestVersion ?? "",
	);
	const [isOpenInternal, setIsOpenInternal] = useState(false);

	const handleCheckUpdates = async () => {
		try {
			const updateData = await getUpdateData();
			const versionToUpdate = updateData.latestVersion || "";
			setHasCheckedUpdate(true);
			setIsUpdateAvailable(updateData.updateAvailable);
			setLatestVersion(versionToUpdate);

			if (updateData.updateAvailable) {
				toast.success(versionToUpdate, {
					description: "New version available!",
				});
			} else {
				toast.info("No updates available");
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
			setHasCheckedUpdate(true);
			setIsUpdateAvailable(false);
			toast.error(
				"An error occurred while checking for updates, please try again.",
			);
		}
	};

	const isOpen = isOpenInternal || isOpenProp;
	const onOpenChange = (open: boolean) => {
		setIsOpenInternal(open);
		onOpenChangeProp?.(open);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<Dialog.Trigger
				render={
					(children ? (
						children
					) : (
						<TooltipProvider delay={0}>
							<Tooltip
								side="right"
								content={<p>Update Available</p>}
								render={
									<Button
										variant={updateData ? "outline" : "secondary"}
										size="sm"
										onClick={() => onOpenChange?.(true)}
									>
										<Download className="h-4 w-4 flex-shrink-0" />
										{updateData ? (
											<span className="font-medium truncate group-data-[collapsible=icon]:hidden">
												Update Available
											</span>
										) : (
											<span className="font-medium truncate group-data-[collapsible=icon]:hidden">
												Check for updates
											</span>
										)}
										{updateData && (
											<span className="absolute right-2 flex h-2 w-2 group-data-[collapsible=icon]:hidden">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kumo-success opacity-75" />
												<span className="relative inline-flex rounded-full h-2 w-2 bg-kumo-success" />
											</span>
										)}
									</Button>
								}
							/>
						</TooltipProvider>
					)) as never
				}
			/>
			<Dialog className="max-w-lg">
				<div className="flex items-center justify-between mb-8">
					<Dialog.Title className="text-2xl font-semibold">
						Runtime Update
					</Dialog.Title>
					{docklandsVersion && (
						<div className="flex items-center gap-1.5 rounded-full px-3 py-1 mr-2 bg-kumo-fill">
							<Server className="h-4 w-4 text-kumo-subtle" />
							<span className="text-sm text-kumo-subtle">
								{docklandsVersion}{" "}
								{(releaseTag === "canary" || releaseTag === "feature") &&
									`(${releaseTag})`}
							</span>
						</div>
					)}
				</div>

				{/* Initial state */}
				{!hasCheckedUpdate && (
					<div className="mb-8">
						<p className="text text-kumo-subtle">
							Check for new releases and update Docklands.
							<br />
							<br />
							We recommend checking for updates regularly to ensure you have the
							latest features and security improvements.
						</p>
					</div>
				)}

				{/* Update available state */}
				{isUpdateAvailable && latestVersion && (
					<div className="mb-8">
						<div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-kumo-success bg-kumo-success-tint mb-4 w-full">
							<div className="flex items-center gap-1.5">
								<Download className="h-4 w-4 text-kumo-success" />
								<span className="text font-medium text-kumo-success ">
									New version available:
								</span>
							</div>
							<span className="text font-semibold text-kumo-success">
								{latestVersion}
							</span>
						</div>

						<div className="space-y-4 text-kumo-subtle">
							<p className="text">
								A new version of the Docklands runtime is available. Consider
								updating if you:
							</p>
							<ul className="space-y-3">
								<li className="flex items-start gap-2">
									<Stars className="h-5 w-5 mt-0.5 text-kumo-info" />
									<span className="text">
										Want to access the latest features and improvements
									</span>
								</li>
								<li className="flex items-start gap-2">
									<Bug className="h-5 w-5 mt-0.5 text-kumo-info" />
									<span className="text">
										Are experiencing issues that may be resolved in the new
										version
									</span>
								</li>
							</ul>
						</div>
					</div>
				)}

				{/* Up to date state */}
				{hasCheckedUpdate && !isUpdateAvailable && !isPending && (
					<div className="mb-8">
						<div className="flex flex-col items-center gap-6 mb-6">
							<div className="rounded-full p-4 bg-kumo-success-tint">
								<Sparkles className="h-8 w-8 text-kumo-success" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-lg font-medium">
									You are using the latest version
								</h3>
								<p className="text text-kumo-subtle">
									Your runtime is up to date with all the latest features and
									security improvements.
								</p>
							</div>
						</div>
					</div>
				)}

				{hasCheckedUpdate && isPending && (
					<div className="mb-8">
						<div className="flex flex-col items-center gap-6 mb-6">
							<div className="rounded-full p-4 bg-kumo-info-tint text-kumo-default">
								<RefreshCcw className="h-8 w-8 animate-spin" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-lg font-medium">Checking for updates...</h3>
								<p className="text text-kumo-subtle">
									Please wait while we pull the latest version information from
									Docker Hub.
								</p>
							</div>
						</div>
					</div>
				)}

				{isUpdateAvailable && (
					<div className="rounded-lg bg-kumo-elevated p-4 mb-8">
						<div className="flex gap-2">
							<Info className="h-5 w-5 flex-shrink-0 text-kumo-info" />
							<div className="text-kumo-info">
								We recommend reviewing the{" "}
								<Link
									href="https://github.com/jason301c/docklands/releases"
									target="_blank"
									className="text-kumo-default underline hover:text-kumo-subtle"
								>
									release notes
								</Link>{" "}
								for any breaking changes before updating.
							</div>
						</div>
					</div>
				)}

				<div className="flex items-center justify-between pt-2">
					<ToggleAutoCheckUpdates disabled={isPending} />
				</div>

				<div className="space-y-4 flex items-center justify-end mt-4	">
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => onOpenChange?.(false)}>
							Cancel
						</Button>
						{isUpdateAvailable ? (
							<ApplyRuntimeUpdate />
						) : (
							<Button
								variant="secondary"
								onClick={handleCheckUpdates}
								disabled={isPending}
							>
								{isPending ? (
									<>
										<RefreshCcw className="h-4 w-4 animate-spin" />
										Checking for updates
									</>
								) : (
									<>
										<RefreshCcw className="h-4 w-4" />
										Check for updates
									</>
								)}
							</Button>
						)}
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};

export default RuntimeUpdateDialog;
