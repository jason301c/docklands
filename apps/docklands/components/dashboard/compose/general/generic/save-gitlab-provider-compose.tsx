import { Button } from "@cloudflare/kumo/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { SaveGitProviderForm } from "@/components/dashboard/shared/git-provider/save-git-provider-form";
import { WatchPathsField } from "@/components/dashboard/shared/git-provider/watch-paths-field";
import { GitlabIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { ScrollArea } from "@/components/shared/scroll-area";
import { toast } from "@/components/shared/toast";
import { VALID_BRANCH_REGEX } from "@/shared/git-branch-validation";
import { cn } from "@/shared/utils";

const logger = createClientLogger("compose");

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/shared/command";

const GitlabProviderSchema = z.object({
	composePath: z.string().min(1),
	repository: z
		.object({
			repo: z.string().min(1, "Repo is required"),
			owner: z.string().min(1, "Owner is required"),
			id: z.number().nullable(),
			gitlabPathNamespace: z.string().min(1),
		})
		.required(),
	branch: z
		.string()
		.min(1, "Branch is required")
		.regex(VALID_BRANCH_REGEX, "Invalid branch name"),
	gitlabId: z.string().min(1, "Gitlab Provider is required"),
	watchPaths: z.array(z.string()).optional(),
	enableSubmodules: z.boolean().default(false),
});

type GitlabProvider = z.infer<typeof GitlabProviderSchema>;

interface Props {
	composeId: string;
}

export const SaveGitlabProviderCompose = ({ composeId }: Props) => {
	const { data: gitlabProviders } = api.gitlab.gitlabProviders.useQuery();
	const { data, refetch } = api.compose.one.useQuery({ composeId });

	const { mutateAsync, isPending: isSavingGitlabProvider } =
		api.compose.update.useMutation();

	const form = useForm({
		defaultValues: {
			composePath: "./docker-compose.yml",
			repository: {
				owner: "",
				repo: "",
				gitlabPathNamespace: "",
				id: null,
			},
			gitlabId: "",
			branch: "",
			watchPaths: [],
			enableSubmodules: false,
		},
		resolver: zodResolver(GitlabProviderSchema),
	});

	const repository = form.watch("repository");
	const gitlabId = form.watch("gitlabId");

	const gitlabUrl = useMemo(() => {
		const url = gitlabProviders?.find(
			(provider) => provider.gitlabId === gitlabId,
		)?.gitlabUrl;

		const gitlabUrl = url?.replace(/\/$/, "");

		return gitlabUrl || "https://gitlab.com";
	}, [gitlabId, gitlabProviders]);

	const {
		data: repositories,
		isLoading: isLoadingRepositories,
		error,
	} = api.gitlab.getGitlabRepositories.useQuery(
		{
			gitlabId,
		},
		{
			enabled: !!gitlabId,
		},
	);

	const {
		data: branches,
		fetchStatus,
		status,
	} = api.gitlab.getGitlabBranches.useQuery(
		{
			owner: repository?.owner,
			repo: repository?.repo,
			id: repository?.id || 0,
			gitlabId: gitlabId,
		},
		{
			enabled: !!repository?.owner && !!repository?.repo && !!gitlabId,
		},
	);

	useEffect(() => {
		if (data) {
			form.reset({
				branch: data.gitlabBranch || "",
				repository: {
					repo: data.gitlabRepository || "",
					owner: data.gitlabOwner || "",
					id: data.gitlabProjectId,
					gitlabPathNamespace: data.gitlabPathNamespace || "",
				},
				composePath: data.composePath,
				gitlabId: data.gitlabId || "",
				watchPaths: data.watchPaths || [],
				enableSubmodules: data.enableSubmodules ?? false,
			});
		}
	}, [form.reset, data?.composeId, form]);

	const onSubmit = async (data: GitlabProvider) => {
		await mutateAsync({
			gitlabBranch: data.branch,
			gitlabRepository: data.repository.repo,
			gitlabOwner: data.repository.owner,
			composePath: data.composePath,
			gitlabId: data.gitlabId,
			composeId,
			gitlabProjectId: data.repository.id,
			gitlabPathNamespace: data.repository.gitlabPathNamespace,
			sourceType: "gitlab",
			composeStatus: "idle",
			watchPaths: data.watchPaths,
			enableSubmodules: data.enableSubmodules,
		})
			.then(async () => {
				toast.success("Service Provider Saved");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save the Gitlab provider", err);
				toast.error("Error saving the Gitlab provider");
			});
	};

	return (
		<SaveGitProviderForm
			form={form}
			onSubmit={form.handleSubmit(onSubmit)}
			alert={error && <AlertBlock type="error">{error?.message}</AlertBlock>}
			accountLabel="GitLab Account"
			accountAriaLabel="Compose GitLab account"
			accountFieldName="gitlabId"
			accounts={gitlabProviders?.map((gitlabProvider) => ({
				id: gitlabProvider.gitlabId,
				name: gitlabProvider.gitProvider.name,
			}))}
			onAccountChange={() => {
				form.setValue("repository", {
					owner: "",
					repo: "",
					gitlabPathNamespace: "",
					id: null,
				});
				form.setValue("branch", "");
			}}
			pathLabel="Compose Path"
			pathPlaceholder="docker-compose.yml"
			pathFieldName="composePath"
			isSaving={isSavingGitlabProvider}
			repositorySelector={
				<FormField
					control={form.control}
					name="repository"
					render={({ field }) => (
						<FormItem className="md:col-span-2 flex flex-col">
							<div className="flex items-center justify-between">
								<FormLabel>Repository</FormLabel>
								{field.value.gitlabPathNamespace && (
									<Link
										href={`${gitlabUrl}/${field.value.gitlabPathNamespace}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-sm text-kumo-subtle hover:text-kumo-brand"
									>
										<GitlabIcon className="h-4 w-4" />
										<span>View Repository</span>
									</Link>
								)}
							</div>
							<Popover>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											className={cn(
												"w-full justify-between !bg-kumo-fill",
												!field.value && "text-kumo-subtle",
											)}
										>
											{!field.value.owner
												? "Select repository"
												: isLoadingRepositories
													? "Loading...."
													: (repositories?.find(
															(repo) => repo.name === field.value.repo,
														)?.name ?? "Select repository")}

											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="p-0" align="start">
									<Command items={[]}>
										<CommandInput
											placeholder="Search repository..."
											className="h-9"
										/>
										{!gitlabId ? (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Select a GitLab account first
											</span>
										) : isLoadingRepositories ? (
											<span className="py-6 text-center text-sm">
												Loading Repositories....
											</span>
										) : null}
										<CommandEmpty>No repositories found.</CommandEmpty>
										<ScrollArea className="h-96">
											<CommandGroup>
												{repositories && repositories.length === 0 && (
													<CommandEmpty>No repositories found.</CommandEmpty>
												)}
												{repositories?.map((repo) => {
													return (
														<CommandItem
															value={repo.url}
															key={repo.url}
															onSelect={() => {
																form.setValue("repository", {
																	owner: repo.owner.username as string,
																	repo: repo.name,
																	id: repo.id,
																	gitlabPathNamespace: repo.url,
																});
																form.setValue("branch", "");
															}}
														>
															<span className="flex items-center gap-2">
																<span>{repo.name}</span>
																<span className="text-kumo-subtle text-xs">
																	{repo.owner.username}
																</span>
															</span>
															<CheckIcon
																className={cn(
																	"ml-auto h-4 w-4",
																	repo.url === field.value.gitlabPathNamespace
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
														</CommandItem>
													);
												})}
											</CommandGroup>
										</ScrollArea>
									</Command>
								</PopoverContent>
							</Popover>
							{form.formState.errors.repository && (
								<p className={cn("text-sm font-medium text-kumo-danger")}>
									Repository is required
								</p>
							)}
						</FormItem>
					)}
				/>
			}
			branchSelector={
				<FormField
					control={form.control}
					name="branch"
					render={({ field }) => (
						<FormItem className="block w-full">
							<FormLabel>Branch</FormLabel>
							<Popover>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											className={cn(
												" w-full justify-between !bg-kumo-fill",
												!field.value && "text-kumo-subtle",
											)}
										>
											{status === "pending" && fetchStatus === "fetching"
												? "Loading...."
												: field.value
													? branches?.find(
															(branch) => branch.name === field.value,
														)?.name
													: "Select branch"}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="p-0" align="start">
									<Command items={[]}>
										<CommandInput
											placeholder="Search branch..."
											className="h-9"
										/>
										{status === "pending" && fetchStatus === "fetching" && (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Loading Branches....
											</span>
										)}
										{!repository?.owner && (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Select a repository
											</span>
										)}
										<ScrollArea className="h-96">
											<CommandEmpty>No branch found.</CommandEmpty>

											<CommandGroup>
												{branches?.map((branch) => (
													<CommandItem
														value={branch.name}
														key={branch.commit.id}
														onSelect={() => {
															form.setValue("branch", branch.name);
														}}
													>
														{branch.name}
														<CheckIcon
															className={cn(
																"ml-auto h-4 w-4",
																branch.name === field.value
																	? "opacity-100"
																	: "opacity-0",
															)}
														/>
													</CommandItem>
												))}
											</CommandGroup>
										</ScrollArea>
									</Command>
								</PopoverContent>

								<FormMessage />
							</Popover>
						</FormItem>
					)}
				/>
			}
			watchPathsField={
				<FormField
					control={form.control}
					name="watchPaths"
					render={({ field }) => (
						<WatchPathsField
							field={field}
							variant="add"
							tooltipIcon="question-mark"
							tooltipAsChild={false}
							setWatchPaths={(paths) => form.setValue("watchPaths", paths)}
						/>
					)}
				/>
			}
		/>
	);
};
