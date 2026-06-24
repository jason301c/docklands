import { Button } from "@cloudflare/kumo/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { SaveGitProviderForm } from "@/components/dashboard/shared/git-provider/save-git-provider-form";
import { WatchPathsField } from "@/components/dashboard/shared/git-provider/watch-paths-field";
import { BitbucketIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
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

const BitbucketProviderSchema = z.object({
	buildPath: z.string().min(1, "Path is required").default("/"),
	repository: z
		.object({
			repo: z.string().min(1, "Repo is required"),
			owner: z.string().min(1, "Owner is required"),
			slug: z.string().optional(),
		})
		.required(),
	branch: z
		.string()
		.min(1, "Branch is required")
		.regex(VALID_BRANCH_REGEX, "Invalid branch name"),
	bitbucketId: z.string().min(1, "Bitbucket Provider is required"),
	watchPaths: z.array(z.string()).optional(),
	enableSubmodules: z.boolean().optional(),
});

type BitbucketProvider = z.infer<typeof BitbucketProviderSchema>;

interface Props {
	applicationId: string;
}

export const SaveBitbucketProvider = ({ applicationId }: Props) => {
	const { data: bitbucketProviders } =
		api.bitbucket.bitbucketProviders.useQuery();
	const { data, refetch } = api.application.one.useQuery({ applicationId });

	const { mutateAsync, isPending: isSavingBitbucketProvider } =
		api.application.saveBitbucketProvider.useMutation();

	const form = useForm({
		defaultValues: {
			buildPath: "/",
			repository: {
				owner: "",
				repo: "",
				slug: "",
			},
			bitbucketId: "",
			branch: "",
			watchPaths: [],
			enableSubmodules: false,
		},
		resolver: zodResolver(BitbucketProviderSchema),
	});

	const repository = form.watch("repository");
	const bitbucketId = form.watch("bitbucketId");

	const {
		data: repositories,
		isLoading: isLoadingRepositories,
		error,
	} = api.bitbucket.getBitbucketRepositories.useQuery(
		{
			bitbucketId,
		},
		{
			enabled: !!bitbucketId,
		},
	);

	const {
		data: branches,
		fetchStatus,
		status,
	} = api.bitbucket.getBitbucketBranches.useQuery(
		{
			owner: repository?.owner,
			repo: repository?.slug || repository?.repo || "",
			bitbucketId,
		},
		{
			enabled:
				!!repository?.owner &&
				!!(repository?.slug || repository?.repo) &&
				!!bitbucketId,
		},
	);

	useEffect(() => {
		if (data) {
			form.reset({
				branch: data.bitbucketBranch || "",
				repository: {
					repo: data.bitbucketRepository || "",
					owner: data.bitbucketOwner || "",
					slug: data.bitbucketRepositorySlug || "",
				},
				buildPath: data.bitbucketBuildPath || "/",
				bitbucketId: data.bitbucketId || "",
				watchPaths: data.watchPaths || [],
				enableSubmodules: data.enableSubmodules || false,
			});
		}
	}, [form.reset, data?.applicationId, form]);

	const onSubmit = async (data: BitbucketProvider) => {
		await mutateAsync({
			bitbucketBranch: data.branch,
			bitbucketRepository: data.repository.repo,
			bitbucketRepositorySlug: data.repository.slug || data.repository.repo,
			bitbucketOwner: data.repository.owner,
			bitbucketBuildPath: data.buildPath,
			bitbucketId: data.bitbucketId,
			applicationId,
			watchPaths: data.watchPaths || [],
			enableSubmodules: data.enableSubmodules || false,
		})
			.then(async () => {
				toast.success("Service Provider Saved");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save the Bitbucket provider", err);
				toast.error("Error saving the Bitbucket provider");
			});
	};

	return (
		<SaveGitProviderForm
			form={form}
			onSubmit={form.handleSubmit(onSubmit)}
			alert={
				error && (
					<AlertBlock type="error">Repositories: {error.message}</AlertBlock>
				)
			}
			accountLabel="Bitbucket Account"
			accountAriaLabel="Bitbucket account"
			accountFieldName="bitbucketId"
			accounts={bitbucketProviders?.map((bitbucketProvider) => ({
				id: bitbucketProvider.bitbucketId,
				name: bitbucketProvider.gitProvider.name,
			}))}
			onAccountChange={() => {
				form.setValue("repository", {
					owner: "",
					repo: "",
					slug: "",
				});
				form.setValue("branch", "");
			}}
			pathLabel="Build Path"
			pathPlaceholder="/"
			pathFieldName="buildPath"
			isSaving={isSavingBitbucketProvider}
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
										href={`https://bitbucket.org/${field.value.owner}/${field.value.slug || field.value.repo}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-sm text-kumo-subtle hover:text-kumo-brand"
									>
										<BitbucketIcon className="h-4 w-4" />
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
										{!bitbucketId ? (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Select a Bitbucket account first
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
																owner: repo.owner.username as string,
																repo: repo.name,
																slug: repo.slug,
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
			watchPathsField={
				<FormField
					control={form.control}
					name="watchPaths"
					render={({ field }) => (
						<WatchPathsField
							field={field}
							variant="add"
							tooltipIcon="help-circle"
							tooltipAsChild={true}
							setWatchPaths={(paths) => form.setValue("watchPaths", paths)}
						/>
					)}
				/>
			}
		/>
	);
};
