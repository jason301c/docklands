import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Code2, FileInput, Globe2, HardDrive } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import { Dialog } from "@/components/shared/dialog";
import { DropdownMenu } from "@/components/shared/dropdown";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { ScrollArea } from "@/components/shared/scroll-area";
import { Separator } from "@/components/shared/separator";
import { toast } from "@/components/shared/toast";
import { slugify } from "@/shared/slug";
import { APP_NAME_MESSAGE, APP_NAME_REGEX } from "@/shared/validation/schema";
import { PlacementFormField } from "./placement-select";

const AddImportSchema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	appName: z
		.string()
		.min(1, { message: "App name is required" })
		.regex(APP_NAME_REGEX, { message: APP_NAME_MESSAGE }),
	base64: z.string().min(1, { message: "Base64 content is required" }),
	runtimeWorkerId: z.string().optional(),
});

type AddImport = z.infer<typeof AddImportSchema>;

type TemplateInfo = {
	compose: string;
	template: {
		domains: Array<{
			serviceName: string;
			port: number;
			path?: string;
			host?: string;
		}>;
		envs: string[];
		mounts: Array<{ filePath: string; content: string }>;
	};
};

interface Props {
	environmentId: string;
	projectName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
}

export const AddImport = ({
	environmentId,
	projectName,
	open: controlledOpen,
	onOpenChange,
	hideTrigger = false,
}: Props) => {
	const utils = api.useUtils();
	const [internalVisible, setInternalVisible] = useState(false);
	const visible = controlledOpen ?? internalVisible;
	const setVisible = onOpenChange ?? setInternalVisible;
	const [previewOpen, setPreviewOpen] = useState(false);
	const [mountOpen, setMountOpen] = useState(false);
	const [selectedMount, setSelectedMount] = useState<{
		filePath: string;
		content: string;
	} | null>(null);
	const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);

	const slug = slugify(projectName);
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const showAutomaticPlacement = !webServerSettings?.remoteServersOnly;
	const { data: servers } = api.runtimeWorker.withSSHKey.useQuery();
	const shouldShowServerDropdown = !!(servers && servers.length > 0);

	const { mutateAsync: previewTemplate, isPending: isProcessing } =
		api.compose.previewTemplate.useMutation();
	const { mutateAsync: createCompose, isPending: isCreating } =
		api.compose.create.useMutation();
	const { mutateAsync: importCompose, isPending: isImporting } =
		api.compose.import.useMutation();

	const form = useForm<AddImport>({
		defaultValues: { name: "", appName: `${slug}-`, base64: "" },
		resolver: zodResolver(AddImportSchema),
	});

	const resetAll = () => {
		form.reset({ name: "", appName: `${slug}-`, base64: "" });
		setTemplateInfo(null);
		setPreviewOpen(false);
		setMountOpen(false);
		setSelectedMount(null);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) resetAll();
		setVisible(open);
	};

	const handleLoad = async (data: AddImport) => {
		try {
			const result = await previewTemplate({
				appName: data.appName,
				base64: data.base64.trim(),
				runtimeWorkerId:
					data.runtimeWorkerId === "docklands"
						? undefined
						: data.runtimeWorkerId,
			});
			setTemplateInfo(result);
			setPreviewOpen(true);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Error processing template",
			);
		}
	};

	const handleImport = async () => {
		const data = form.getValues();
		try {
			const compose = await createCompose({
				name: data.name,
				appName: data.appName,
				environmentId,
				composeType: "docker-compose",
				runtimeWorkerId:
					data.runtimeWorkerId === "docklands"
						? undefined
						: data.runtimeWorkerId,
			});
			await importCompose({
				composeId: compose.composeId,
				base64: data.base64.trim(),
			});
			toast.success("Compose imported successfully");
			await utils.environment.one.invalidate({ environmentId });
			resetAll();
			setVisible(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Error importing compose",
			);
		}
	};

	const handleCancelPreview = () => {
		setPreviewOpen(false);
		setTemplateInfo(null);
	};

	return (
		<>
			<Dialog.Root open={visible} onOpenChange={handleOpenChange}>
				{!hideTrigger && (
					<Dialog.Trigger className="w-full">
						<DropdownMenu.Item
							className="w-full cursor-pointer space-x-3"
							onSelect={(e) => e.preventDefault()}
						>
							<FileInput className="size-4 text-kumo-subtle" />
							<span>Import</span>
						</DropdownMenu.Item>
					</Dialog.Trigger>
				)}
				<Dialog className="sm:max-w-xl">
					<Dialog.Header>
						<Dialog.Title>Import Compose</Dialog.Title>
						<Dialog.Description>
							Paste a base64-encoded compose export to preview and import it
						</Dialog.Description>
					</Dialog.Header>

					<Form {...form}>
						<form
							id="hook-form-import"
							onSubmit={form.handleSubmit(handleLoad)}
							className="grid w-full gap-4"
						>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input
												placeholder="My App"
												{...field}
												onChange={(e) => {
													const val = e.target.value || "";
													form.setValue(
														"appName",
														`${slug}-${slugify(val.trim())}`,
													);
													field.onChange(val);
												}}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{shouldShowServerDropdown && (
								<PlacementFormField
									control={form.control}
									name="runtimeWorkerId"
									ariaLabel="Import placement"
									workers={servers}
									showAutomaticPlacement={showAutomaticPlacement}
									optional={showAutomaticPlacement}
									description="Docklands uses automatic placement by default. Choose a runtime worker only when this import needs manual placement."
								/>
							)}

							<FormField
								control={form.control}
								name="appName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>App Name</FormLabel>
										<FormControl>
											<Input placeholder="my-app" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="base64"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Compose (Base64)</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Paste your base64-encoded Docker Compose file here..."
												className="font-mono resize-none h-32"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Dialog.Footer>
								<Button
									type="submit"
									variant="outline"
									loading={isCreating || isProcessing}
								>
									Load
								</Button>
							</Dialog.Footer>
						</form>
					</Form>
				</Dialog>
			</Dialog.Root>

			{/* Preview modal */}
			<Dialog.Root
				open={previewOpen}
				onOpenChange={(open) => !open && handleCancelPreview()}
			>
				<Dialog className="max-w-[60vw]">
					<Dialog.Header>
						<Dialog.Title className="text-2xl font-bold">
							Template Information
						</Dialog.Title>
						<Dialog.Description className="space-y-2">
							<p>Review the template information before importing</p>
							<AlertBlock type="warning">
								Warning: This will remove all existing environment variables,
								mounts, and domains from this service.
							</AlertBlock>
						</Dialog.Description>
					</Dialog.Header>

					<div className="flex flex-col gap-6">
						<div className="space-y-4">
							<div className="flex items-center gap-2">
								<Code2 className="h-5 w-5 text-kumo-brand" />
								<h3 className="text-lg font-semibold">Docker Compose</h3>
							</div>
							<CodeEditor
								language="yaml"
								value={templateInfo?.compose || ""}
								className="font-mono"
								readOnly
							/>
						</div>

						{templateInfo?.template.domains &&
							templateInfo.template.domains.length > 0 && (
								<>
									<Separator />
									<div className="space-y-4">
										<div className="flex items-center gap-2">
											<Globe2 className="h-5 w-5 text-kumo-brand" />
											<h3 className="text-lg font-semibold">Domains</h3>
										</div>
										<div className="grid grid-cols-1 gap-3">
											{templateInfo.template.domains.map((domain, index) => (
												<div
													key={index}
													className="rounded-lg border bg-kumo-base p-3 text-kumo-default shadow-sm"
												>
													<div className="font-medium">
														{domain.serviceName}
													</div>
													<div className="text-sm text-kumo-subtle space-y-1">
														<div>Port: {domain.port}</div>
														{domain.host && <div>Host: {domain.host}</div>}
														{domain.path && <div>Path: {domain.path}</div>}
													</div>
												</div>
											))}
										</div>
									</div>
								</>
							)}

						{templateInfo?.template.envs &&
							templateInfo.template.envs.length > 0 && (
								<>
									<Separator />
									<div className="space-y-4">
										<div className="flex items-center gap-2">
											<Code2 className="h-5 w-5 text-kumo-brand" />
											<h3 className="text-lg font-semibold">
												Environment Variables
											</h3>
										</div>
										<div className="grid grid-cols-1 gap-2">
											{templateInfo.template.envs.map((env, index) => (
												<div
													key={index}
													className="rounded-lg truncate border bg-kumo-base p-2 font-mono text-sm"
												>
													{env}
												</div>
											))}
										</div>
									</div>
								</>
							)}

						{templateInfo?.template.mounts &&
							templateInfo.template.mounts.length > 0 && (
								<>
									<Separator />
									<div className="space-y-4">
										<div className="flex items-center gap-2">
											<HardDrive className="h-5 w-5 text-kumo-brand" />
											<h3 className="text-lg font-semibold">Mounts</h3>
										</div>
										<div className="grid grid-cols-1 gap-2">
											{templateInfo.template.mounts.map((mount, index) => (
												<div
													key={index}
													className="rounded-lg border bg-kumo-base p-2 font-mono text-sm hover:bg-kumo-fill-hover cursor-pointer transition-colors"
													onClick={() => {
														setSelectedMount(mount);
														setMountOpen(true);
													}}
												>
													{mount.filePath}
												</div>
											))}
										</div>
									</div>
								</>
							)}
					</div>

					<Dialog.Footer>
						<Button variant="outline" onClick={handleCancelPreview}>
							Cancel
						</Button>
						<Button loading={isImporting} onClick={handleImport}>
							Import
						</Button>
					</Dialog.Footer>
				</Dialog>
			</Dialog.Root>

			{/* Mount content modal */}
			<Dialog.Root open={mountOpen} onOpenChange={setMountOpen}>
				<Dialog className="max-w-[50vw]">
					<Dialog.Header>
						<Dialog.Title className="text-xl font-bold">
							{selectedMount?.filePath}
						</Dialog.Title>
						<Dialog.Description>Mount File Content</Dialog.Description>
					</Dialog.Header>
					<ScrollArea className="h-[45vh] pr-4">
						<CodeEditor
							language="yaml"
							value={selectedMount?.content || ""}
							className="font-mono"
							readOnly
						/>
					</ScrollArea>
					<Dialog.Footer>
						<Button onClick={() => setMountOpen(false)}>Close</Button>
					</Dialog.Footer>
				</Dialog>
			</Dialog.Root>
		</>
	);
};
