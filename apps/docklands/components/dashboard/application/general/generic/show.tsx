import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { GitBranch, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { SaveDockerProvider } from "@/components/dashboard/application/general/generic/save-docker-provider";
import { SaveGitProvider } from "@/components/dashboard/application/general/generic/save-git-provider";
import { SaveGiteaProvider } from "@/components/dashboard/application/general/generic/save-gitea-provider";
import { SaveGithubProvider } from "@/components/dashboard/application/general/generic/save-github-provider";
import {
	BitbucketIcon,
	DockerIcon,
	GiteaIcon,
	GithubIcon,
	GitIcon,
	GitlabIcon,
} from "@/components/icons/data-tools-icons";
import { toast } from "@/components/shared/toast";
import { SaveBitbucketProvider } from "./save-bitbucket-provider";
import { SaveDragNDrop } from "./save-drag-n-drop";
import { SaveGitlabProvider } from "./save-gitlab-provider";
import { UnauthorizedGitProvider } from "./unauthorized-git-provider";

type TabState =
	| "github"
	| "docker"
	| "git"
	| "drop"
	| "gitlab"
	| "bitbucket"
	| "gitea";

interface Props {
	applicationId: string;
}

export const ShowProviderForm = ({ applicationId }: Props) => {
	const { data: githubProviders, isPending: isLoadingGithub } =
		api.github.githubProviders.useQuery();
	const { data: gitlabProviders, isPending: isLoadingGitlab } =
		api.gitlab.gitlabProviders.useQuery();
	const { data: bitbucketProviders, isPending: isLoadingBitbucket } =
		api.bitbucket.bitbucketProviders.useQuery();
	const { data: giteaProviders, isPending: isLoadingGitea } =
		api.gitea.giteaProviders.useQuery();

	const { data: application, refetch } = api.application.one.useQuery({
		applicationId,
	});
	const { mutateAsync: disconnectGitProvider } =
		api.application.disconnectGitProvider.useMutation();

	const [tab, setSab] = useState<TabState>(application?.sourceType || "github");

	const isLoading =
		isLoadingGithub || isLoadingGitlab || isLoadingBitbucket || isLoadingGitea;

	const handleDisconnect = async () => {
		try {
			await disconnectGitProvider({ applicationId });
			toast.success("Repository disconnected successfully");
			await refetch();
		} catch (error) {
			toast.error(
				`Failed to disconnect repository: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	};

	if (isLoading) {
		return (
			<LayerCard className="group relative w-full bg-transparent">
				<div>
					<h3 className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<span className="flex flex-col space-y-0.5">Provider</span>
							<p className="flex items-center text-sm font-normal text-muted-foreground">
								Select the source of your code
							</p>
						</div>
						<div className="hidden space-y-1 text-sm font-normal md:block">
							<GitBranch className="size-6 text-muted-foreground" />
						</div>
					</h3>
				</div>
				<div>
					<div className="flex min-h-[25vh] items-center justify-center">
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							<span>Loading providers...</span>
						</div>
					</div>
				</div>
			</LayerCard>
		);
	}

	// Check if user doesn't have access to the current git provider
	if (
		application &&
		!application.hasGitProviderAccess &&
		application.sourceType !== "docker" &&
		application.sourceType !== "drop"
	) {
		return (
			<LayerCard className="group relative w-full bg-transparent">
				<div>
					<h3 className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<span className="flex flex-col space-y-0.5">Provider</span>
							<p className="flex items-center text-sm font-normal text-muted-foreground">
								Repository connection through unauthorized provider
							</p>
						</div>
						<div className="hidden space-y-1 text-sm font-normal md:block">
							<GitBranch className="size-6 text-muted-foreground" />
						</div>
					</h3>
				</div>
				<div>
					<UnauthorizedGitProvider
						service={application}
						onDisconnect={handleDisconnect}
					/>
				</div>
			</LayerCard>
		);
	}

	return (
		<LayerCard className="group relative w-full bg-transparent">
			<div>
				<h3 className="flex items-start justify-between">
					<div className="flex flex-col gap-2">
						<span className="flex flex-col space-y-0.5">Provider</span>
						<p className="flex items-center text-sm font-normal text-muted-foreground">
							Select the source of your code
						</p>
					</div>
					<div className="hidden space-y-1 text-sm font-normal md:block">
						<GitBranch className="size-6 text-muted-foreground" />
					</div>
				</h3>
			</div>
			<div>
				<div className="w-full">
					<Tabs
						value={tab}
						className="w-full overflow-auto"
						onValueChange={(e) => {
							if (e === null) return;
							setSab(e as TabState);
						}}
						tabs={[
							{
								value: "github",
								label: (
									<span className="inline-flex items-center gap-2">
										<GithubIcon className="size-4 text-current fill-current" />
										Github
									</span>
								),
							},
							{
								value: "gitlab",
								label: (
									<span className="inline-flex items-center gap-2">
										<GitlabIcon className="size-4 text-current fill-current" />
										Gitlab
									</span>
								),
							},
							{
								value: "bitbucket",
								label: (
									<span className="inline-flex items-center gap-2">
										<BitbucketIcon className="size-4 text-current fill-current" />
										Bitbucket
									</span>
								),
							},
							{
								value: "gitea",
								label: (
									<span className="inline-flex items-center gap-2">
										<GiteaIcon className="size-4 text-current fill-current" />
										Gitea
									</span>
								),
							},
							{
								value: "docker",
								label: (
									<span className="inline-flex items-center gap-2">
										<DockerIcon className="size-5 text-current" />
										Container Image
									</span>
								),
							},
							{
								value: "git",
								label: (
									<span className="inline-flex items-center gap-2">
										<GitIcon />
										Git
									</span>
								),
							},
							{
								value: "drop",
								label: (
									<span className="inline-flex items-center gap-2">
										<UploadCloud className="size-5 text-current" />
										Drop
									</span>
								),
							},
						]}
					/>

					{tab === "github" && (
						<div className="w-full p-2">
							{githubProviders && githubProviders?.length > 0 ? (
								<SaveGithubProvider applicationId={applicationId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GithubIcon className="size-8 text-muted-foreground" />
									<span className="text-base text-muted-foreground">
										To build from GitHub, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-foreground"
										>
											Settings
										</Link>{" "}
										to do so.
									</span>
								</div>
							)}
						</div>
					)}
					{tab === "gitlab" && (
						<div className="w-full p-2">
							{gitlabProviders && gitlabProviders?.length > 0 ? (
								<SaveGitlabProvider applicationId={applicationId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GitlabIcon className="size-8 text-muted-foreground" />
									<span className="text-base text-muted-foreground">
										To build from GitLab, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-foreground"
										>
											Settings
										</Link>{" "}
										to do so.
									</span>
								</div>
							)}
						</div>
					)}
					{tab === "bitbucket" && (
						<div className="w-full p-2">
							{bitbucketProviders && bitbucketProviders?.length > 0 ? (
								<SaveBitbucketProvider applicationId={applicationId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<BitbucketIcon className="size-8 text-muted-foreground" />
									<span className="text-base text-muted-foreground">
										To build from Bitbucket, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-foreground"
										>
											Settings
										</Link>{" "}
										to do so.
									</span>
								</div>
							)}
						</div>
					)}
					{tab === "gitea" && (
						<div className="w-full p-2">
							{giteaProviders && giteaProviders?.length > 0 ? (
								<SaveGiteaProvider applicationId={applicationId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GiteaIcon className="size-8 text-muted-foreground" />
									<span className="text-base text-muted-foreground">
										To build from Gitea, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-foreground"
										>
											Settings
										</Link>{" "}
										to do so.
									</span>
								</div>
							)}
						</div>
					)}
					{tab === "docker" && (
						<div className="w-full p-2">
							<SaveDockerProvider applicationId={applicationId} />
						</div>
					)}

					{tab === "git" && (
						<div className="w-full p-2">
							<SaveGitProvider applicationId={applicationId} />
						</div>
					)}
					{tab === "drop" && (
						<div className="w-full p-2">
							<SaveDragNDrop applicationId={applicationId} />
						</div>
					)}
				</div>
			</div>
		</LayerCard>
	);
};
