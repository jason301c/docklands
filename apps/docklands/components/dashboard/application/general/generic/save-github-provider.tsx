import { Button } from "@cloudflare/kumo/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CheckIcon, ChevronsUpDown, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { SaveGitProviderForm } from "@/components/dashboard/shared/git-provider/save-git-provider-form";
import { WatchPathsField } from "@/components/dashboard/shared/git-provider/watch-paths-field";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/shared/command";
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

const logger = createClientLogger("application");

const GithubProviderSchema = z.object({
	buildPath: z.string().min(1, "Path is required").default("/"),
	repository: z
		.object({
			repo: z.string().min(1, "Repo is required"),
			owner: z.string().min(1, "Owner is required"),
		})
		.required(),
	branch: z
		.string()
		.min(1, "Branch is required")
		.regex(VALID_BRANCH_REGEX, "Invalid branch name"),
	githubId: z.string().min(1, "Github Provider is required"),
	watchPaths: z.array(z.string()).optional(),
	triggerType: z.enum(["push", "tag"]).default("push"),
	enableSubmodules: z.boolean().default(false),
});

type GithubProvider = z.infer<typeof GithubProviderSchema>;

interface Props {
	applicationId: string;
}

export const SaveGithubProvider = ({ applicationId }: Props) => {
	const { data: githubProviders } = api.github.githubProviders.useQuery();
	const { data, refetch } = api.application.one.useQuery({ applicationId });

	const { mutateAsync, isPending: isSavingGithubProvider } =
		api.application.saveGithubProvider.useMutation();

	const form = useForm({
		defaultValues: {
			buildPath: "/",
			repository: {
				owner: "",
				repo: "",
			},
			githubId: "",
			branch: "",
			triggerType: "push",
			enableSubmodules: false,
		},
		resolver: zodResolver(GithubProviderSchema),
	});

	const repository = form.watch("repository");
	const githubId = form.watch("githubId");
	const triggerType = form.watch("triggerType");

	const { data: repositories, isPending: isLoadingRepositories } =
		api.github.getGithubRepositories.useQuery(
			{
				githubId,
			},
			{
				enabled: !!githubId,
			},
		);

	const {
		data: branches,
		fetchStatus,
		status,
	} = api.github.getGithubBranches.useQuery(
		{
			owner: repository?.owner,
			repo: repository?.repo,
			githubId,
		},
		{
			enabled: !!repository?.owner && !!repository?.repo && !!githubId,
		},
	);

	useEffect(() => {
		if (data) {
			form.reset({
				branch: data.branch || "",
				repository: {
					repo: data.repository || "",
					owner: data.owner || "",
				},
				buildPath: data.buildPath || "/",
				githubId: data.githubId || "",
				watchPaths: data.watchPaths || [],
				triggerType: data.triggerType || "push",
				enableSubmodules: data.enableSubmodules ?? false,
			});
		}
	}, [form.reset, data?.applicationId, form]);

	const onSubmit = async (data: GithubProvider) => {
		await mutateAsync({
			branch: data.branch,
			repository: data.repository.repo,
			applicationId,
			owner: data.repository.owner,
			buildPath: data.buildPath,
			githubId: data.githubId,
			watchPaths: data.watchPaths || [],
			triggerType: data.triggerType,
			enableSubmodules: data.enableSubmodules,
		})
			.then(async () => {
				toast.success("Service Provider Saved");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save the github provider", err);
				toast.error("Error saving the github provider");
			});
	};

	return (
		<SaveGitProviderForm
			form={form}
			onSubmit={form.handleSubmit(onSubmit)}
			accountLabel="GitHub Account"
			accountAriaLabel="GitHub account"
			accountFieldName="githubId"
			accounts={githubProviders?.map((githubProvider) => ({
				id: githubProvider.githubId,
				name: githubProvider.gitProvider.name,
			}))}
			onAccountChange={() => {
				form.setValue("repository", {
					owner: "",
					repo: "",
				});
				form.setValue("branch", "");
			}}
			pathLabel="Build Path"
			pathPlaceholder="/"
			pathFieldName="buildPath"
			isSaving={isSavingGithubProvider}
			repositorySelector={
				<FormField
					control={form.control}
					name="repository"
					render={({ field }) => (
						<FormItem className="md:col-span-2 flex flex-col">
							<div className="flex items-center justify-between">
								<FormLabel>Repository</FormLabel>
								{field.value.owner && field.value.repo && (
									<Link
										href={`https://github.com/${field.value.owner}/${field.value.repo}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-sm text-kumo-subtle hover:text-kumo-brand"
									>
										<GithubIcon className="h-4 w-4" />
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
												"w-full justify-between !bg-input",
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
										{!githubId ? (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Select a GitHub account first
											</span>
										) : isLoadingRepositories ? (
											<span className="py-6 text-center text-sm">
												Loading Repositories....
											</span>
										) : null}
										<CommandEmpty>No repositories found.</CommandEmpty>
										<ScrollArea className="h-96">
											<CommandGroup>
												{repositories?.map((repo) => (
													<CommandItem
														value={repo.name}
														key={repo.url}
														onSelect={() => {
															form.setValue("repository", {
																owner: repo.owner.login as string,
																repo: repo.name,
															});
															form.setValue("branch", "");
														}}
													>
														<span className="flex items-center gap-2">
															<span>{repo.name}</span>
															<span className="text-kumo-subtle text-xs">
																{repo.owner.login}
															</span>
														</span>
														<CheckIcon
															className={cn(
																"ml-auto h-4 w-4",
																repo.name === field.value.repo
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
												" w-full justify-between !bg-input",
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
														key={branch.commit.sha}
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
			triggerTypeField={
				<FormField
					control={form.control}
					name="triggerType"
					render={({ field }) => (
						<FormItem className="md:col-span-2">
							<div className="flex items-center gap-2 ">
								<FormLabel>Trigger Type</FormLabel>
								<TooltipProvider>
									<Tooltip
										content={
											<>
												<p>
													Choose when to trigger builds: on push to the selected
													branch or when a new tag is created.
												</p>
											</>
										}
										asChild
									>
										<HelpCircle className="size-4 text-kumo-subtle hover:text-kumo-default transition-colors cursor-pointer" />
									</Tooltip>
								</TooltipProvider>
							</div>
							<Select
								aria-label="GitHub trigger type"
								onValueChange={field.onChange}
								defaultValue={field.value}
								value={field.value}
							>
								<FormControl>
									<></>
								</FormControl>
								<>
									<Select.Option value="push">On Push</Select.Option>
									<Select.Option value="tag">On Tag</Select.Option>
								</>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
			}
			watchPathsField={
				triggerType === "push" && (
					<FormField
						control={form.control}
						name="watchPaths"
						render={({ field }) => (
							<WatchPathsField
								field={field}
								variant="plus"
								tooltipIcon="help-circle"
								tooltipAsChild={true}
								setWatchPaths={(paths) => field.onChange(paths)}
							/>
						)}
					/>
				)
			}
		/>
	);
};
