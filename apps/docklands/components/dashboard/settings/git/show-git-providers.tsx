import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, buttonVariants } from "@cloudflare/kumo/components/button";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { formatDate } from "date-fns";
import {
	ExternalLinkIcon,
	GitBranch,
	ImportIcon,
	Loader2,
	Trash2,
	Users,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/client/api/trpc";
import { useUrl } from "@/client/hooks/use-url";
import {
	BitbucketIcon,
	GiteaIcon,
	GithubIcon,
	GitlabIcon,
} from "@/components/icons/data-tools-icons";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { AddBitbucketProvider } from "./bitbucket/add-bitbucket-provider";
import { EditBitbucketProvider } from "./bitbucket/edit-bitbucket-provider";
import { AddGiteaProvider } from "./gitea/add-gitea-provider";
import { EditGiteaProvider } from "./gitea/edit-gitea-provider";
import { AddGithubProvider } from "./github/add-github-provider";
import { EditGithubProvider } from "./github/edit-github-provider";
import { AddGitlabProvider } from "./gitlab/add-gitlab-provider";
import { EditGitlabProvider } from "./gitlab/edit-gitlab-provider";

export const ShowGitProviders = () => {
	const { data, isPending, refetch } = api.gitProvider.getAll.useQuery();
	const { mutateAsync, isPending: isRemoving } =
		api.gitProvider.remove.useMutation();
	const { mutateAsync: toggleShare, isPending: isToggling } =
		api.gitProvider.toggleShare.useMutation();
	const { data: currentMember } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const url = useUrl();
	const isOrgAdmin =
		currentMember?.role === "owner" || currentMember?.role === "admin";

	const getGitlabUrl = (
		clientId: string,
		gitlabId: string,
		gitlabUrl: string,
	) => {
		const redirectUri = `${url}/api/providers/gitlab/callback?gitlabId=${gitlabId}`;
		const scope = "api read_user read_repository";
		const authUrl = `${gitlabUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scopes=${encodeURIComponent(scope)}`;
		return authUrl;
	};

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<GitBranch className="size-6 text-kumo-subtle self-center" />
						Git Providers
					</h3>
					<p>Connect your Git provider for authentication.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{data?.length === 0 ? (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GitBranch className="size-8 self-center text-kumo-subtle" />
									<span className="text-base text-kumo-subtle text-center">
										No Git Providers configured
									</span>
									{permissions?.gitProviders.create && (
										<div>
											<div className="flex items-center bg-kumo-elevated p-1 w-full rounded-lg">
												<div className="flex flex-wrap items-center gap-4 p-3.5 rounded-lg bg-kumo-canvas border w-full [&>button]:grow">
													<AddGithubProvider />
													<AddGitlabProvider />
													<AddBitbucketProvider />
													<AddGiteaProvider />
												</div>
											</div>
										</div>
									)}
								</div>
							) : (
								<div className="flex flex-col gap-4 min-h-[25vh]">
									<div className="flex flex-col gap-2 rounded-lg ">
										<span className="text-base font-medium">
											Available Providers
										</span>
										{permissions?.gitProviders.create && (
											<div className="flex items-center bg-kumo-elevated p-1 w-full rounded-lg">
												<div className="flex flex-wrap items-center gap-4 p-3.5 rounded-lg bg-kumo-canvas border w-full [&>button]:grow">
													<AddGithubProvider />
													<AddGitlabProvider />
													<AddBitbucketProvider />
													<AddGiteaProvider />
												</div>
											</div>
										)}
									</div>

									<div className="flex flex-col gap-4 rounded-lg ">
										{data?.map((gitProvider, _index) => {
											const isGithub = gitProvider.providerType === "github";
											const isGitlab = gitProvider.providerType === "gitlab";
											const isBitbucket =
												gitProvider.providerType === "bitbucket";
											const isGitea = gitProvider.providerType === "gitea";
											const canManage = gitProvider.isOwner || isOrgAdmin;

											const haveGithubRequirements =
												isGithub && gitProvider.github?.isConfigured;

											const haveGitlabRequirements =
												isGitlab && gitProvider.gitlab?.isConfigured;

											return (
												<div
													key={gitProvider.gitProviderId}
													className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
												>
													<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border w-full">
														<div className="flex flex-col items-center justify-between">
															<div className="flex gap-2 flex-row items-center">
																{isGithub && <GithubIcon className="size-5" />}
																{isGitlab && <GitlabIcon className="size-5" />}
																{isBitbucket && (
																	<BitbucketIcon className="size-5" />
																)}
																{isGitea && <GiteaIcon className="size-5" />}
																<div className="flex flex-col gap-1">
																	<span className="text-sm font-medium">
																		{gitProvider.name}
																	</span>
																	<span className="text-xs text-kumo-subtle">
																		{formatDate(
																			gitProvider.createdAt,
																			"yyyy-MM-dd hh:mm:ss a",
																		)}
																	</span>
																</div>
																{!gitProvider.isOwner && (
																	<Badge
																		variant="secondary"
																		className="text-xs"
																	>
																		<Users className="size-3 mr-1" />
																		Shared
																	</Badge>
																)}
															</div>
														</div>

														<div className="flex flex-row gap-1 items-center">
															{gitProvider.isOwner && (
																<TooltipProvider delay={0}>
																	<Tooltip
																		content={
																			<>Share with entire organization</>
																		}
																		asChild
																	>
																		<div className="flex items-center gap-1.5 mr-2">
																			<Users className="size-4 text-kumo-subtle" />
																			<Switch
																				disabled={isToggling}
																				checked={
																					gitProvider.sharedWithOrganization
																				}
																				onCheckedChange={async (checked) => {
																					await toggleShare({
																						gitProviderId:
																							gitProvider.gitProviderId,
																						sharedWithOrganization: checked,
																					})
																						.then(() => {
																							toast.success(
																								checked
																									? "Provider shared with organization"
																									: "Provider unshared",
																							);
																							refetch();
																						})
																						.catch(() => {
																							toast.error(
																								"Error updating sharing",
																							);
																						});
																				}}
																			/>
																		</div>
																	</Tooltip>
																</TooltipProvider>
															)}

															{!haveGithubRequirements && isGithub && (
																<div className="flex flex-row gap-1 items-center">
																	<Badge variant="outline" className="text-xs">
																		Action Required
																	</Badge>
																	<Link
																		href={`${gitProvider?.github?.githubAppName}/installations/new?state=gh_setup:${gitProvider?.github?.githubId}`}
																		className={buttonVariants({
																			shape: "square",
																			variant: "ghost",
																		})}
																	>
																		<ImportIcon className="size-4 text-kumo-brand" />
																	</Link>
																</div>
															)}
															{haveGithubRequirements && isGithub && (
																<div className="flex flex-col gap-1">
																	<Link
																		href={`${gitProvider?.github?.githubAppName}`}
																		target="_blank"
																		className={buttonVariants({
																			shape: "square",
																			variant: "ghost",
																		})}
																	>
																		<ExternalLinkIcon className="size-4 text-kumo-brand" />
																	</Link>
																</div>
															)}
															{!haveGitlabRequirements && isGitlab && (
																<div className="flex flex-row gap-1 items-center">
																	<Badge variant="outline" className="text-xs">
																		Action Required
																	</Badge>
																	<Link
																		href={getGitlabUrl(
																			gitProvider.gitlab?.applicationId || "",
																			gitProvider.gitlab?.gitlabId || "",
																			gitProvider.gitlab?.gitlabUrl || "",
																		)}
																		target="_blank"
																		className={buttonVariants({
																			shape: "square",
																			variant: "ghost",
																		})}
																	>
																		<ImportIcon className="size-4 text-kumo-brand" />
																	</Link>
																</div>
															)}

															{canManage && (
																<>
																	{isGithub &&
																		haveGithubRequirements &&
																		gitProvider.github?.githubId && (
																			<EditGithubProvider
																				githubId={gitProvider.github.githubId}
																			/>
																		)}

																	{isGitlab && gitProvider.gitlab?.gitlabId && (
																		<EditGitlabProvider
																			gitlabId={gitProvider.gitlab.gitlabId}
																		/>
																	)}

																	{isBitbucket &&
																		gitProvider.bitbucket?.bitbucketId && (
																			<EditBitbucketProvider
																				bitbucketId={
																					gitProvider.bitbucket.bitbucketId
																				}
																			/>
																		)}

																	{isGitea && gitProvider.gitea?.giteaId && (
																		<EditGiteaProvider
																			giteaId={gitProvider.gitea.giteaId}
																		/>
																	)}

																	<DialogAction
																		title="Delete Git Provider"
																		description={
																			gitProvider.sharedWithOrganization
																				? "This provider is shared with the organization. Deleting it will remove access for all members. Are you sure?"
																				: "Are you sure you want to delete this Git Provider?"
																		}
																		type="destructive"
																		onClick={async () => {
																			await mutateAsync({
																				gitProviderId:
																					gitProvider.gitProviderId,
																			})
																				.then(() => {
																					toast.success(
																						"Git Provider deleted successfully",
																					);
																					refetch();
																				})
																				.catch(() => {
																					toast.error(
																						"Error deleting Git Provider",
																					);
																				});
																		}}
																	>
																		<Button
																			aria-label="Delete Git provider"
																			variant="ghost"
																			shape="square"
																			className="group hover:bg-kumo-danger/10"
																			loading={isRemoving}
																		>
																			<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
																		</Button>
																	</DialogAction>
																</>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>

									<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
										{/* <AddCertificate /> */}
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
