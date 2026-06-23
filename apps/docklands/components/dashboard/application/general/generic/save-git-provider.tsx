import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { HelpCircle, KeyRoundIcon, LockIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { GitIcon } from "@/components/icons/data-tools-icons";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { VALID_BRANCH_REGEX } from "@/server/core/utils/git-branch-validation";

const logger = createClientLogger("application");

const GitProviderSchema = z.object({
	buildPath: z.string().min(1, "Path is required").default("/"),
	repositoryURL: z.string().min(1, {
		message: "Repository URL is required",
	}),
	branch: z
		.string()
		.min(1, "Branch required")
		.regex(VALID_BRANCH_REGEX, "Invalid branch name"),
	sshKey: z.string().optional(),
	watchPaths: z.array(z.string()).optional(),
	enableSubmodules: z.boolean().default(false),
});

type GitProvider = z.infer<typeof GitProviderSchema>;

interface Props {
	applicationId: string;
}

export const SaveGitProvider = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery({ applicationId });
	const { data: sshKeys } = api.sshKey.allForApps.useQuery();
	const router = useRouter();

	const { mutateAsync, isPending } =
		api.application.saveGitProvider.useMutation();

	const form = useForm({
		defaultValues: {
			branch: "",
			buildPath: "/",
			repositoryURL: "",
			sshKey: undefined,
			watchPaths: [],
			enableSubmodules: false,
		},
		resolver: zodResolver(GitProviderSchema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				sshKey: data.customGitSSHKeyId || undefined,
				branch: data.customGitBranch || "",
				buildPath: data.customGitBuildPath || "/",
				repositoryURL: data.customGitUrl || "",
				watchPaths: data.watchPaths || [],
				enableSubmodules: data.enableSubmodules ?? false,
			});
		}
	}, [form.reset, data, form]);

	const onSubmit = async (values: GitProvider) => {
		await mutateAsync({
			customGitBranch: values.branch,
			customGitBuildPath: values.buildPath,
			customGitUrl: values.repositoryURL,
			customGitSSHKeyId: values.sshKey === "none" ? null : values.sshKey,
			applicationId,
			watchPaths: values.watchPaths || [],
			enableSubmodules: values.enableSubmodules,
		})
			.then(async () => {
				toast.success("Git Provider Saved");
				await refetch();
			})
			.catch((err) => {
				logger.error("Failed to save the Git provider", err);
				toast.error("Error saving the Git provider");
			});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
					<FormField
						control={form.control}
						name="repositoryURL"
						render={({ field }) => (
							<FormItem className="col-span-2 lg:col-span-3">
								<div className="flex items-center justify-between h-5">
									<FormLabel>Repository URL</FormLabel>
									{field.value?.startsWith("https://") && (
										<Link
											href={field.value}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1 text-sm text-kumo-subtle hover:text-kumo-brand"
										>
											<GitIcon className="h-4 w-4" />
											<span>View Repository</span>
										</Link>
									)}
								</div>
								<FormControl>
									<Input placeholder="Repository URL" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{sshKeys && sshKeys.length > 0 ? (
						<FormField
							control={form.control}
							name="sshKey"
							render={({ field }) => (
								<FormItem className="col-span-2 lg:col-span-1">
									<FormLabel className="w-full inline-flex justify-between">
										SSH Key
										<LockIcon className="size-4 text-kumo-subtle" />
									</FormLabel>
									<FormControl>
										<Select
											aria-label="Git provider"
											key={field.value}
											onValueChange={field.onChange}
											defaultValue={field.value}
											value={field.value}
										>
											<></>
											<>
												<Select.Group>
													{sshKeys?.map((sshKey) => (
														<Select.Option
															key={sshKey.sshKeyId}
															value={sshKey.sshKeyId}
														>
															{sshKey.name}
														</Select.Option>
													))}
													<Select.Option value="none">None</Select.Option>
													<Select.GroupLabel>
														Keys ({sshKeys?.length})
													</Select.GroupLabel>
												</Select.Group>
											</>
										</Select>
									</FormControl>
								</FormItem>
							)}
						/>
					) : (
						<Button
							variant="secondary"
							onClick={() => router.push("/dashboard/settings/ssh-keys")}
							type="button"
							className="col-span-2 lg:col-span-1 lg:mt-7"
						>
							<KeyRoundIcon className="size-4" /> Add SSH Key
						</Button>
					)}

					<FormField
						control={form.control}
						name="branch"
						render={({ field }) => (
							<FormItem className="col-span-2">
								<FormLabel>Branch</FormLabel>
								<FormControl>
									<Input placeholder="Branch" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="buildPath"
						render={({ field }) => (
							<FormItem className="col-span-2">
								<FormLabel>Build Path</FormLabel>
								<FormControl>
									<Input placeholder="/" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="watchPaths"
						render={({ field }) => (
							<FormItem className="col-span-2 lg:col-span-4">
								<div className="flex items-center gap-2">
									<FormLabel>Watch Paths</FormLabel>
									<TooltipProvider>
										<Tooltip
											content={
												<>
													<p>
														Add paths to watch for changes. When files in these
														paths change, a new build will be triggered. This
														will work only when manual webhook is setup.
													</p>
												</>
											}
											className="max-w-[300px]"
											asChild
										>
											<HelpCircle className="size-4 text-kumo-subtle hover:text-kumo-default transition-colors cursor-pointer" />
										</Tooltip>
									</TooltipProvider>
								</div>
								<div className="flex flex-wrap gap-2 mb-2">
									{field.value?.map((path, index) => (
										<Badge key={index} variant="secondary">
											{path}
											<X
												className="ml-1 size-3 cursor-pointer"
												onClick={() => {
													const newPaths = [...(field.value || [])];
													newPaths.splice(index, 1);
													form.setValue("watchPaths", newPaths);
												}}
											/>
										</Badge>
									))}
								</div>
								<FormControl>
									<div className="flex gap-2">
										<Input
											placeholder="Enter a path to watch (e.g., src/**, dist/*.js)"
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													const input = e.currentTarget;
													const value = input.value.trim();
													if (value) {
														const newPaths = [...(field.value || []), value];
														form.setValue("watchPaths", newPaths);
														input.value = "";
													}
												}
											}}
										/>
										<Button
											type="button"
											variant="secondary"
											onClick={() => {
												const input = document.querySelector(
													'input[placeholder="Enter a path to watch (e.g., src/**, dist/*.js)"]',
												) as HTMLInputElement;
												const value = input.value.trim();
												if (value) {
													const newPaths = [...(field.value || []), value];
													form.setValue("watchPaths", newPaths);
													input.value = "";
												}
											}}
										>
											Add
										</Button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="enableSubmodules"
						render={({ field }) => (
							<FormItem className="flex items-center space-x-2">
								<FormControl>
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
								<FormLabel className="!mt-0">Enable Submodules</FormLabel>
							</FormItem>
						)}
					/>
				</div>

				<div className="flex flex-row justify-end">
					<Button type="submit" className="w-fit" loading={isPending}>
						Save
					</Button>
				</div>
			</form>
		</Form>
	);
};
