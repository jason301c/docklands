import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Combobox } from "@cloudflare/kumo/components/combobox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import {
	Bookmark,
	BookText,
	CheckIcon,
	ChevronsUpDown,
	Globe,
	LayoutGrid,
	List,
	Loader2,
	PuzzleIcon,
	SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { ScrollArea } from "@/components/shared/scroll-area";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import { PlacementSelect } from "./placement-select";

const Command = Combobox;
const CommandInput = Combobox.TriggerInput;
const CommandList = Combobox.List;
const CommandGroup = Combobox.Group;
const CommandItem = Combobox.Item;
const CommandEmpty = Combobox.Empty;

interface Props {
	environmentId: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
}

export const AddTemplate = ({
	environmentId,
	open: controlledOpen,
	onOpenChange,
	hideTrigger = false,
}: Props) => {
	const [query, setQuery] = useState("");
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;
	const [viewMode, setViewMode] = useState<"detailed" | "icon">("detailed");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

	// Get environment data to extract the backing workspace id.
	const { data: environment } = api.environment.one.useQuery({ environmentId });

	const {
		data,
		isLoading: isLoadingTemplates,
		error: errorTemplates,
		isError: isErrorTemplates,
	} = api.compose.templates.useQuery(
		{},
		{
			enabled: open,
		},
	);
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const showAutomaticPlacement =
		!isCloud && !webServerSettings?.remoteServersOnly;
	const { data: runtimeWorkers } = api.runtimeWorker.withSSHKey.useQuery();
	const { data: tags, isPending: isLoadingTags } = api.compose.getTags.useQuery(
		{},
		{
			enabled: open,
		},
	);

	const { data: bookmarkIds = [], isLoading: isLoadingBookmarks } =
		api.user.getBookmarkedTemplates.useQuery(undefined, {
			enabled: open,
		});

	const utils = api.useUtils();

	const { mutateAsync: toggleBookmark } =
		api.user.toggleTemplateBookmark.useMutation({
			onMutate: async ({ templateId }) => {
				await utils.user.getBookmarkedTemplates.cancel();
				const previousBookmarks = utils.user.getBookmarkedTemplates.getData();

				utils.user.getBookmarkedTemplates.setData(undefined, (old = []) => {
					if (old.includes(templateId)) {
						return old.filter((id) => id !== templateId);
					}
					return [...old, templateId];
				});

				return { previousBookmarks };
			},
			onError: (_err, _variables, context) => {
				if (context?.previousBookmarks) {
					utils.user.getBookmarkedTemplates.setData(
						undefined,
						context.previousBookmarks,
					);
				}
				toast.error("Failed to update bookmark");
			},
			onSuccess: (data) => {
				toast.success(
					data.isBookmarked ? "Added to bookmarks" : "Removed from bookmarks",
				);
			},
		});

	const [runtimeWorkerId, setRuntimeWorkerId] = useState<string | undefined>(
		undefined,
	);
	const { mutateAsync, isPending, error, isError } =
		api.compose.deployTemplate.useMutation();

	const templates =
		data?.filter((template) => {
			const matchesTags =
				selectedTags.length === 0 ||
				template.tags.some((tag) => selectedTags.includes(tag));
			const matchesQuery =
				query === "" ||
				template.name.toLowerCase().includes(query.toLowerCase()) ||
				template.description.toLowerCase().includes(query.toLowerCase());
			const matchesBookmarks =
				!showBookmarksOnly || bookmarkIds.includes(template.id);
			return matchesTags && matchesQuery && matchesBookmarks;
		}) || [];

	const hasRuntimeWorkers = runtimeWorkers && runtimeWorkers.length > 0;
	const shouldShowRuntimeWorkerDropdown = hasRuntimeWorkers;

	const handleToggleBookmark = async (
		e: React.MouseEvent,
		templateId: string,
	) => {
		e.stopPropagation();
		await toggleBookmark({ templateId });
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			{!hideTrigger && (
				<Dialog.Trigger className="w-full">
					<DropdownMenu.Item
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						<PuzzleIcon className="size-4 text-kumo-subtle" />
						<span>Template</span>
					</DropdownMenu.Item>
				</Dialog.Trigger>
			)}
			<Dialog className="sm:max-w-[90vw] p-0">
				<div className="sticky top-0 z-10 bg-kumo-canvas p-6 border-b">
					<div className="flex flex-col space-y-6">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
							<div>
								<Dialog.Title>Create from Template</Dialog.Title>
								<Dialog.Description>
									Create an open source application from a template
								</Dialog.Description>
							</div>
							<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
								<Input
									aria-label="Search templates"
									placeholder="Search Template"
									onChange={(e) => setQuery(e.target.value)}
									className="w-full"
									value={query}
								/>
								<Popover modal={true}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"w-full sm:w-[200px] justify-between !border-kumo-line",
											)}
										>
											{isLoadingTags
												? "Loading...."
												: selectedTags.length > 0
													? `Selected ${selectedTags.length} tags`
													: "Select tag"}

											<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="p-0" align="start">
										<Command items={[]}>
											<CommandInput
												placeholder="Search tag..."
												className="h-9"
											/>
											{isLoadingTags && (
												<span className="py-6 text-center text-sm">
													Loading Tags....
												</span>
											)}
											<CommandEmpty>No tags found.</CommandEmpty>
											<ScrollArea className="h-96">
												<CommandGroup>
													{tags?.map((tag) => (
														<CommandItem
															value={tag}
															key={tag}
															onSelect={() => {
																if (selectedTags.includes(tag)) {
																	setSelectedTags(
																		selectedTags.filter((t) => t !== tag),
																	);
																	return;
																}
																setSelectedTags([...selectedTags, tag]);
															}}
														>
															{tag}
															<CheckIcon
																className={cn(
																	"ml-auto h-4 w-4",
																	selectedTags.includes(tag)
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
								<Button
									aria-label="Show bookmarked templates"
									variant={showBookmarksOnly ? "secondary" : "outline"}
									shape="square"
									onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
									className="h-9 w-9 flex-shrink-0"
									disabled={isLoadingBookmarks}
								>
									<Bookmark
										className={cn(
											"size-4",
											showBookmarksOnly && "fill-current",
										)}
									/>
								</Button>
								<Button
									aria-label="Toggle template layout"
									shape="square"
									onClick={() =>
										setViewMode(viewMode === "detailed" ? "icon" : "detailed")
									}
									className="h-9 w-9 flex-shrink-0"
								>
									{viewMode === "detailed" ? (
										<LayoutGrid className="size-4" />
									) : (
										<List className="size-4" />
									)}
								</Button>
							</div>
						</div>
						{selectedTags.length > 0 && (
							<div className="flex flex-wrap justify-end gap-2">
								{selectedTags.map((tag) => (
									<Button
										type="button"
										key={tag}
										variant="secondary"
										size="xs"
										className="cursor-pointer"
										onClick={() =>
											setSelectedTags(selectedTags.filter((t) => t !== tag))
										}
									>
										{tag} ×
									</Button>
								))}
							</div>
						)}
					</div>
				</div>

				<ScrollArea className="h-[calc(98vh-8rem)]">
					<div className="p-6">
						{isError && (
							<AlertBlock type="error" className="mb-4">
								{error?.message}
							</AlertBlock>
						)}

						{isErrorTemplates && (
							<AlertBlock type="error" className="mb-4">
								{errorTemplates?.message}
							</AlertBlock>
						)}

						{isLoadingTemplates ? (
							<div className="flex justify-center items-center w-full h-full flex-row gap-4">
								<Loader2 className="size-8 text-kumo-subtle animate-spin min-h-[60vh]" />
								<div className="text-lg font-medium text-kumo-subtle">
									Loading templates...
								</div>
							</div>
						) : templates.length === 0 ? (
							<div className="flex flex-col justify-center items-center w-full gap-2 min-h-[50vh]">
								<SearchIcon className="text-kumo-subtle size-6" />
								<div className="text-xl font-medium text-kumo-subtle">
									{showBookmarksOnly
										? "No bookmarked templates found"
										: "No templates found"}
								</div>
								{showBookmarksOnly && (
									<p className="text-sm text-kumo-subtle">
										Click the bookmark icon on templates to add them to
										bookmarks
									</p>
								)}
							</div>
						) : (
							<div
								className={cn(
									"grid gap-6",
									viewMode === "detailed"
										? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
										: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
								)}
							>
								{templates?.map((template, idx) => (
									<div
										key={`${template.id}-${template.version || "default"}-${idx}`}
										className={cn(
											"flex flex-col border rounded-lg overflow-hidden relative",
											viewMode === "icon" && "h-[200px]",
											viewMode === "detailed" && "h-[400px]",
										)}
									>
										<div className="absolute top-2 left-2 z-10">
											<Button
												aria-label="Toggle template bookmark"
												variant="ghost"
												shape="square"
												className="h-8 w-8 bg-kumo-canvas/80 backdrop-blur-sm hover:bg-kumo-canvas"
												onClick={(e) => handleToggleBookmark(e, template.id)}
											>
												<Bookmark
													className={cn(
														"size-4",
														bookmarkIds.includes(template.id) &&
															"fill-kumo-warning text-kumo-warning",
													)}
												/>
											</Button>
										</div>
										<div className="absolute top-2 right-2">
											<Badge variant="blue">{template?.version}</Badge>
										</div>
										<div
											className={cn(
												"flex-none p-6 pb-3 flex flex-col items-center gap-4 bg-kumo-fill/30",
												viewMode === "detailed" && "border-b",
											)}
										>
											<img
												src={template?.logo}
												className={cn(
													"object-contain",
													viewMode === "detailed" ? "size-24" : "size-16",
												)}
												alt={template?.name}
											/>
											<div className="flex flex-col items-center gap-2">
												<span className="text-sm font-medium line-clamp-1">
													{template?.name}
												</span>
												{viewMode === "detailed" &&
													template?.tags?.length > 0 && (
														<div className="flex flex-wrap justify-center gap-1.5">
															{template?.tags?.map((tag) => (
																<Badge
																	key={tag}
																	variant="green"
																	className="text-[10px] px-2 py-0"
																>
																	{tag}
																</Badge>
															))}
														</div>
													)}
											</div>
										</div>

										{/* Template Content */}
										{viewMode === "detailed" && (
											<ScrollArea className="flex-1 p-6">
												<div className="text-sm text-kumo-subtle">
													{template?.description}
												</div>
											</ScrollArea>
										)}

										{/* Create Button */}
										<div
											className={cn(
												"flex-none px-6 py-3 mt-auto",
												viewMode === "detailed"
													? "flex items-center justify-between bg-kumo-fill/30 border-t"
													: "flex justify-center",
											)}
										>
											{viewMode === "detailed" && (
												<div className="flex gap-2">
													{template?.links?.github && (
														<Link
															href={template?.links?.github}
															target="_blank"
															className="text-kumo-subtle hover:text-kumo-default transition-colors"
														>
															<GithubIcon className="size-5" />
														</Link>
													)}
													{template?.links?.website && (
														<Link
															href={template?.links?.website}
															target="_blank"
															className="text-kumo-subtle hover:text-kumo-default transition-colors"
														>
															<Globe className="size-5" />
														</Link>
													)}
													{template?.links?.docs && (
														<Link
															href={template?.links?.docs}
															target="_blank"
															className="text-kumo-subtle hover:text-kumo-default transition-colors"
														>
															<BookText className="size-5" />
														</Link>
													)}
												</div>
											)}
											<Dialog.Root role="alertdialog">
												<Dialog.Trigger
													render={
														<Button
															variant="secondary"
															size="sm"
															className={cn(
																"w-auto",
																viewMode === "detailed" && "w-auto",
															)}
														>
															Create
														</Button>
													}
												/>
												<Dialog>
													<div>
														<Dialog.Title>
															Are you absolutely sure?
														</Dialog.Title>
														<Dialog.Description>
															This will create an application from the{" "}
															{template?.name} template and add it to your
															workspace.
														</Dialog.Description>

														{shouldShowRuntimeWorkerDropdown && (
															<PlacementSelect
																ariaLabel="Template placement"
																value={runtimeWorkerId}
																onValueChange={setRuntimeWorkerId}
																workers={runtimeWorkers}
																showAutomaticPlacement={showAutomaticPlacement}
																optional={showAutomaticPlacement}
																description="Docklands uses automatic placement by default. Choose a runtime worker only when this template needs manual placement."
															/>
														)}
													</div>
													<div>
														<Dialog.Close
															render={
																<Button variant="secondary">Cancel</Button>
															}
														/>
														<Dialog.Close
															render={
																<Button
																	disabled={isPending}
																	onClick={async () => {
																		const promise = mutateAsync({
																			runtimeWorkerId:
																				runtimeWorkerId === "docklands"
																					? undefined
																					: runtimeWorkerId,
																			environmentId,
																			id: template.id,
																		});
																		toast.promise(promise, {
																			loading: "Setting up...",
																			success: () => {
																				// Refresh the workspace environment data.
																				utils.environment.one.invalidate({
																					environmentId,
																				});
																				setOpen(false);
																				return `${template.name} template created successfully`;
																			},
																			error: () => {
																				return `An error occurred deploying ${template.name} template`;
																			},
																		});
																	}}
																>
																	Confirm
																</Button>
															}
														/>
													</div>
												</Dialog>
											</Dialog.Root>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</ScrollArea>
			</Dialog>
		</Dialog.Root>
	);
};
