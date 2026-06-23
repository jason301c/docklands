import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Textarea } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Code2, Globe2, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
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

const logger = createClientLogger("application");

const ImportSchema = z.object({
	base64: z.string(),
});

type ImportType = z.infer<typeof ImportSchema>;

interface Props {
	composeId: string;
}

export const ShowImport = ({ composeId }: Props) => {
	const [showModal, setShowModal] = useState(false);
	const [showMountContent, setShowMountContent] = useState(false);
	const [selectedMount, setSelectedMount] = useState<{
		filePath: string;
		content: string;
	} | null>(null);
	const [templateInfo, setTemplateInfo] = useState<{
		compose: string;
		template: {
			domains: Array<{
				serviceName: string;
				port: number;
				path?: string;
				host?: string;
			}>;
			envs: string[];
			mounts: Array<{
				filePath: string;
				content: string;
			}>;
		};
	} | null>(null);

	const utils = api.useUtils();
	const { mutateAsync: processTemplate, isPending: isLoadingTemplate } =
		api.compose.processTemplate.useMutation();
	const {
		mutateAsync: importTemplate,
		isPending: isImporting,
		isSuccess: isImportSuccess,
	} = api.compose.import.useMutation();

	const form = useForm<ImportType>({
		defaultValues: {
			base64: "",
		},
		resolver: zodResolver(ImportSchema),
	});

	useEffect(() => {
		form.reset({
			base64: "",
		});
	}, [isImportSuccess]);

	const onSubmit = async () => {
		const base64 = form.getValues("base64");
		if (!base64) {
			toast.error("Please enter a base64 Compose file");
			return;
		}

		try {
			await importTemplate({
				composeId,
				base64,
			});
			toast.success("Compose imported successfully");
			await utils.compose.one.invalidate({
				composeId,
			});
			setShowModal(false);
		} catch (err) {
			logger.error("Error importing compose file", err);
			toast.error("Error importing compose file");
		}
	};

	const handleLoadTemplate = async () => {
		const base64 = form.getValues("base64");
		if (!base64) {
			toast.error("Please enter a base64 Compose file");
			return;
		}

		try {
			const result = await processTemplate({
				composeId,
				base64,
			});
			setTemplateInfo(result);
			setShowModal(true);
		} catch (err) {
			logger.error("Error processing compose file", err);
			toast.error("Error processing compose file");
		}
	};

	const handleShowMountContent = (mount: {
		filePath: string;
		content: string;
	}) => {
		setSelectedMount(mount);
		setShowMountContent(true);
	};

	return (
		<>
			<LayerCard className="bg-kumo-canvas">
				<div>
					<h3 className="text-xl font-semibold">Import Compose</h3>
					<p>Import a base64-encoded Docker Compose file</p>
				</div>
				<div className="flex flex-col gap-4">
					<AlertBlock type="warning">
						Warning: Importing a compose file will remove all existing
						environment variables, mounts, and domains from this service.
					</AlertBlock>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="grid w-full gap-4"
						>
							<FormField
								control={form.control}
								name="base64"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Compose (Base64)</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Paste your base64-encoded Docker Compose file here..."
												className="font-mono min-h-[200px]"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									className="w-fit"
									variant="outline"
									loading={isLoadingTemplate}
									onClick={handleLoadTemplate}
								>
									Load
								</Button>
							</div>
							<Dialog.Root open={showModal} onOpenChange={setShowModal}>
								<Dialog className="max-w-[50vw]">
									<div>
										<Dialog.Title className="text-2xl font-bold">
											Template Information
										</Dialog.Title>
										<Dialog.Description className="space-y-2">
											<p>Review the template information before importing</p>
											<AlertBlock type="warning">
												Warning: This will remove all existing environment
												variables, mounts, and domains from this service.
											</AlertBlock>
										</Dialog.Description>
									</div>

									<div className="flex flex-col gap-6">
										<div className="space-y-4">
											<div className="flex items-center gap-2">
												<Code2 className="h-5 w-5 text-kumo-brand" />
												<h3 className="text-lg font-semibold">
													Docker Compose
												</h3>
											</div>
											<CodeEditor
												language="yaml"
												value={templateInfo?.compose || ""}
												className="font-mono"
												readOnly
											/>
										</div>

										<Separator />

										{templateInfo?.template.domains &&
											templateInfo.template.domains.length > 0 && (
												<div className="space-y-4">
													<div className="flex items-center gap-2">
														<Globe2 className="h-5 w-5 text-kumo-brand" />
														<h3 className="text-lg font-semibold">Domains</h3>
													</div>
													<div className="grid grid-cols-1 gap-3">
														{templateInfo.template.domains.map(
															(domain, index) => (
																<div
																	key={index}
																	className="rounded-lg border bg-kumo-base p-3 text-kumo-default shadow-sm"
																>
																	<div className="font-medium">
																		{domain.serviceName}
																	</div>
																	<div className="text-sm text-kumo-subtle space-y-1">
																		<div>Port: {domain.port}</div>
																		{domain.host && (
																			<div>Host: {domain.host}</div>
																		)}
																		{domain.path && (
																			<div>Path: {domain.path}</div>
																		)}
																	</div>
																</div>
															),
														)}
													</div>
												</div>
											)}

										{templateInfo?.template.envs &&
											templateInfo.template.envs.length > 0 && (
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
											)}

										{templateInfo?.template.mounts &&
											templateInfo.template.mounts.length > 0 && (
												<div className="space-y-4">
													<div className="flex items-center gap-2">
														<HardDrive className="h-5 w-5 text-kumo-brand" />
														<h3 className="text-lg font-semibold">Mounts</h3>
													</div>
													<div className="grid grid-cols-1 gap-2">
														{templateInfo.template.mounts.map(
															(mount, index) => (
																<div
																	key={index}
																	className="rounded-lg border bg-kumo-base p-2 font-mono text-sm hover:bg-kumo-fill-hover cursor-pointer transition-colors"
																	onClick={() => handleShowMountContent(mount)}
																>
																	{mount.filePath}
																</div>
															),
														)}
													</div>
												</div>
											)}
									</div>

									<div className="flex justify-end gap-2 pt-4">
										<Button
											variant="outline"
											onClick={() => setShowModal(false)}
										>
											Cancel
										</Button>
										<Button
											loading={isImporting}
											type="submit"
											onClick={form.handleSubmit(onSubmit)}
											className="w-fit"
										>
											Import
										</Button>
									</div>
								</Dialog>
							</Dialog.Root>
						</form>
					</Form>
				</div>
			</LayerCard>

			<Dialog.Root open={showMountContent} onOpenChange={setShowMountContent}>
				<Dialog className="max-w-[50vw]">
					<div>
						<Dialog.Title className="text-xl font-bold">
							{selectedMount?.filePath}
						</Dialog.Title>
						<Dialog.Description>Mount File Content</Dialog.Description>
					</div>

					<ScrollArea className="h-[45vh] pr-4">
						<CodeEditor
							language="yaml"
							value={selectedMount?.content || ""}
							className="font-mono"
							readOnly
						/>
					</ScrollArea>

					<div className="flex justify-end gap-2 pt-4">
						<Button onClick={() => setShowMountContent(false)}>Close</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
};
