import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { CodeIcon, GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { UnauthorizedGitProvider } from "@/components/dashboard/application/general/generic/unauthorized-git-provider";
import {
	BitbucketIcon,
	GiteaIcon,
	GithubIcon,
	GitIcon,
	GitlabIcon,
} from "@/components/icons/data-tools-icons";
import { toast } from "@/components/shared/toast";
import { ComposeFileEditor } from "../compose-file-editor";
import { ShowConvertedCompose } from "../show-converted-compose";
import { SaveBitbucketProviderCompose } from "./save-bitbucket-provider-compose";
import { SaveGitProviderCompose } from "./save-git-provider-compose";
import { SaveGiteaProviderCompose } from "./save-gitea-provider-compose";
import { SaveGithubProviderCompose } from "./save-github-provider-compose";
import { SaveGitlabProviderCompose } from "./save-gitlab-provider-compose";

type TabState = "github" | "git" | "raw" | "gitlab" | "bitbucket" | "gitea";
interface Props {
	composeId: string;
}

export const ShowProviderFormCompose = ({ composeId }: Props) => {
	const { data: githubProviders, isPending: isLoadingGithub } =
		api.github.githubProviders.useQuery();
	const { data: gitlabProviders, isPending: isLoadingGitlab } =
		api.gitlab.gitlabProviders.useQuery();
	const { data: bitbucketProviders, isPending: isLoadingBitbucket } =
		api.bitbucket.bitbucketProviders.useQuery();
	const { data: giteaProviders, isPending: isLoadingGitea } =
		api.gitea.giteaProviders.useQuery();

	const { mutateAsync: disconnectGitProvider } =
		api.compose.disconnectGitProvider.useMutation();

	const { data: compose, refetch } = api.compose.one.useQuery({ composeId });
	const [tab, setSab] = useState<TabState>(compose?.sourceType || "github");

	const isLoading =
		isLoadingGithub || isLoadingGitlab || isLoadingBitbucket || isLoadingGitea;

	const handleDisconnect = async () => {
		try {
			await disconnectGitProvider({ composeId });
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
							<p className="flex items-center text-sm font-normal text-kumo-subtle">
								Select the source of your code
							</p>
						</div>
						<div className="hidden space-y-1 text-sm font-normal md:block">
							<GitBranch className="size-6 text-kumo-subtle" />
						</div>
					</h3>
				</div>
				<div>
					<div className="flex min-h-[25vh] items-center justify-center">
						<div className="flex items-center gap-2 text-kumo-subtle">
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
		compose &&
		!compose.hasGitProviderAccess &&
		compose.sourceType !== "raw"
	) {
		return (
			<LayerCard className="group relative w-full bg-transparent">
				<div>
					<h3 className="flex items-start justify-between">
						<div className="flex flex-col gap-2">
							<span className="flex flex-col space-y-0.5">Provider</span>
							<p className="flex items-center text-sm font-normal text-kumo-subtle">
								Repository connection through unauthorized provider
							</p>
						</div>
						<div className="hidden space-y-1 text-sm font-normal md:block">
							<GitBranch className="size-6 text-kumo-subtle" />
						</div>
					</h3>
				</div>
				<div>
					<UnauthorizedGitProvider
						service={compose}
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
						<p className="flex items-center text-sm font-normal text-kumo-subtle">
							Select the source of your code
						</p>
					</div>
					<div className="hidden space-y-1 text-sm font-normal md:flex flex-row items-center gap-2">
						<ShowConvertedCompose composeId={composeId} />
						<GitBranch className="size-6 text-kumo-subtle" />
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
										GitHub
									</span>
								),
							},
							{
								value: "gitlab",
								label: (
									<span className="inline-flex items-center gap-2">
										<GitlabIcon className="size-4 text-current fill-current" />
										GitLab
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
								value: "git",
								label: (
									<span className="inline-flex items-center gap-2">
										<GitIcon />
										Git
									</span>
								),
							},
							{
								value: "raw",
								label: (
									<span className="inline-flex items-center gap-2">
										<CodeIcon className="size-4" />
										Raw
									</span>
								),
							},
						]}
					/>

					{tab === "github" && (
						<div className="w-full p-2">
							{githubProviders && githubProviders?.length > 0 ? (
								<SaveGithubProviderCompose composeId={composeId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GithubIcon className="size-8 text-kumo-subtle" />
									<span className="text-base text-kumo-subtle">
										To build from GitHub, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-kumo-default"
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
								<SaveGitlabProviderCompose composeId={composeId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GitlabIcon className="size-8 text-kumo-subtle" />
									<span className="text-base text-kumo-subtle">
										To build from GitLab, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-kumo-default"
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
								<SaveBitbucketProviderCompose composeId={composeId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<BitbucketIcon className="size-8 text-kumo-subtle" />
									<span className="text-base text-kumo-subtle">
										To build from Bitbucket, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-kumo-default"
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
								<SaveGiteaProviderCompose composeId={composeId} />
							) : (
								<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
									<GiteaIcon className="size-8 text-kumo-subtle" />
									<span className="text-base text-kumo-subtle">
										To build from Gitea, you need to configure your account
										first. Please, go to{" "}
										<Link
											href="/dashboard/settings/git-providers"
											className="text-kumo-default"
										>
											Settings
										</Link>{" "}
										to do so.
									</span>
								</div>
							)}
						</div>
					)}
					{tab === "git" && (
						<div className="w-full p-2">
							<SaveGitProviderCompose composeId={composeId} />
						</div>
					)}

					{tab === "raw" && (
						<div className="w-full p-2 flex flex-col gap-4">
							<ComposeFileEditor composeId={composeId} />
						</div>
					)}
				</div>
			</div>
		</LayerCard>
	);
};
