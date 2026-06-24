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
import type { Repository } from "@/client/git/gitea";
import { createClientLogger } from "@/client/lib/logger";
import { SaveGitProviderForm } from "@/components/dashboard/shared/git-provider/save-git-provider-form";
import { WatchPathsField } from "@/components/dashboard/shared/git-provider/watch-paths-field";
import { GiteaIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
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

const GiteaProviderSchema = z.object({
	composePath: z.string().min(1),
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
	giteaId: z.string().min(1, "Gitea Provider is required"),
	watchPaths: z.array(z.string()).optional(),
	enableSubmodules: z.boolean().default(false),
});

type GiteaProvider = z.infer<typeof GiteaProviderSchema>;

interface Props {
	composeId: string;
}

export const SaveGiteaProviderCompose = ({ composeId }: Props) => {
	const { data: giteaProviders } = api.gitea.giteaProviders.useQuery();
	const { data, refetch } = api.compose.one.useQuery({ composeId });
	const { mutateAsync, isPending: isSavingGiteaProvider } =
		api.compose.update.useMutation();

	const form = useForm({
		defaultValues: {
			composePath: "./docker-compose.yml",
			repository: {
				owner: "",
				repo: "",
			},
			giteaId: "",
			branch: "",
			watchPaths: [],
			enableSubmodules: false,
		},
		resolver: zodResolver(GiteaProviderSchema),
	});

	const repository = form.watch("repository");
	const giteaId = form.watch("giteaId");

	const { data: giteaUrl } = api.gitea.getGiteaUrl.useQuery(
		{ giteaId },
		{
			enabled: !!giteaId,
		},
	);

	const {
		data: repositories,
		isLoading: isLoadingRepositories,
		error,
	} = api.gitea.getGiteaRepositories.useQuery<Repository[]>(
		{
			giteaId,
		},
		{
			enabled: !!giteaId,
		},
	);

	const {
		data: branches,
		fetchStatus,
		status,
	} = api.gitea.getGiteaBranches.useQuery(
		{
			owner: repository?.owner,
			repositoryName: repository?.repo,
			giteaId: giteaId,
		},
		{
			enabled: !!repository?.owner && !!repository?.repo && !!giteaId,
		},
	);

	useEffect(() => {
		if (data) {
			form.reset({
				branch: data.giteaBranch || "",
				repository: {
					repo: data.giteaRepository || "",
					owner: data.giteaOwner || "",
				},
				composePath: data.composePath || "./docker-compose.yml",
				giteaId: data.giteaId || "",
				watchPaths: data.watchPaths || [],
				enableSubmodules: data.enableSubmodules ?? false,
			});
		}
	}, [form.reset, data?.composeId, form]);

	const onSubmit = async (data: GiteaProvider) => {
		await mutateAsync({
			giteaBranch: data.branch,
			giteaRepository: data.repository.repo,
			giteaOwner: data.repository.owner,
			composePath: data.composePath,
			giteaId: data.giteaId,
			composeId,
			sourceType: "gitea",
			composeStatus: "idle",
			watchPaths: data.watchPaths,
			enableSubmodules: data.enableSubmodules,
		} as any)
			.then(async () => {
				toast.success("Service Provider Saved");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save the Gitea provider", err);
				toast.error("Error saving the Gitea provider");
			});
	};

	return (
		<SaveGitProviderForm
			form={form}
			onSubmit={form.handleSubmit(onSubmit)}
			alert={error && <AlertBlock type="error">{error?.message}</AlertBlock>}
			accountLabel="Gitea Account"
			accountAriaLabel="Compose Gitea account"
			accountFieldName="giteaId"
			accounts={giteaProviders?.map((giteaProvider) => ({
				id: giteaProvider.giteaId,
				name: giteaProvider.gitProvider.name,
			}))}
			onAccountChange={() => {
				form.setValue("repository", {
					owner: "",
					repo: "",
				});
				form.setValue("branch", "");
			}}
			pathLabel="Compose Path"
			pathPlaceholder="docker-compose.yml"
			pathFieldName="composePath"
			isSaving={isSavingGiteaProvider}
			submitWrapperClassName="flex justify-end"
			submitButtonClassName=""
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
										href={`${giteaUrl}/${field.value.owner}/${field.value.repo}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-sm text-kumo-subtle hover:text-kumo-brand"
									>
										<GiteaIcon className="h-4 w-4" />
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
										{!giteaId ? (
											<span className="py-6 text-center text-sm text-kumo-subtle">
												Select a Gitea account first
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
														key={repo.url}
														value={repo.name}
														onSelect={() => {
															form.setValue("repository", {
																owner: repo.owner.username,
																repo: repo.name,
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
												"w-full justify-between !bg-kumo-fill",
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
											placeholder="Search branches..."
											className="h-9"
										/>
										<CommandEmpty>No branches found.</CommandEmpty>
										<ScrollArea className="h-96">
											<CommandGroup>
												{branches?.map((branch) => (
													<CommandItem
														key={branch.name}
														value={branch.name}
														onSelect={() =>
															form.setValue("branch", branch.name)
														}
													>
														<span className="flex items-center gap-2">
															{branch.name}
														</span>
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
							</Popover>
							{form.formState.errors.branch && (
								<p className={cn("text-sm font-medium text-kumo-danger")}>
									Branch is required
								</p>
							)}
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
							variant="plus-hybrid"
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
