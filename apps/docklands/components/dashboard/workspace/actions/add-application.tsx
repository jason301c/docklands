import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Folder, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { slugify } from "@/shared/slug";
import { APP_NAME_MESSAGE, APP_NAME_REGEX } from "@/shared/validation/schema";

const AddTemplateSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	appName: z
		.string()
		.min(1, {
			message: "App name is required",
		})
		.regex(APP_NAME_REGEX, {
			message: APP_NAME_MESSAGE,
		}),
	description: z.string().optional(),
	serverId: z.string().optional(),
});

type AddTemplate = z.infer<typeof AddTemplateSchema>;

interface Props {
	environmentId: string;
	projectName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
}

export const AddApplication = ({
	environmentId,
	projectName,
	open: controlledOpen,
	onOpenChange,
	hideTrigger = false,
}: Props) => {
	const utils = api.useUtils();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const showLocalOption = !isCloud && !webServerSettings?.remoteServersOnly;
	const [internalVisible, setInternalVisible] = useState(false);
	const visible = controlledOpen ?? internalVisible;
	const setVisible = onOpenChange ?? setInternalVisible;
	const slug = slugify(projectName);
	const { data: servers } = api.server.withSSHKey.useQuery();

	const hasServers = servers && servers.length > 0;
	// Show placement only when there is more than the local runtime to choose.
	const shouldShowServerDropdown = hasServers;

	const { mutateAsync, isPending, error, isError } =
		api.application.create.useMutation();

	const form = useForm<AddTemplate>({
		defaultValues: {
			name: "",
			appName: `${slug}-`,
			description: "",
		},
		resolver: zodResolver(AddTemplateSchema),
	});

	const onSubmit = async (data: AddTemplate) => {
		await mutateAsync({
			name: data.name,
			appName: data.appName,
			description: data.description,
			serverId: data.serverId === "docklands" ? undefined : data.serverId,
			environmentId,
		})
			.then(async () => {
				toast.success("Service Created");
				form.reset();
				setVisible(false);
				await utils.environment.one.invalidate({
					environmentId,
				});
			})
			.catch(() => {
				toast.error("Error creating the service");
			});
	};

	return (
		<Dialog.Root open={visible} onOpenChange={setVisible}>
			{!hideTrigger && (
				<Dialog.Trigger className="w-full">
					<DropdownMenu.Item
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						<Folder className="size-4 text-muted-foreground" />
						<span>Application</span>
					</DropdownMenu.Item>
				</Dialog.Trigger>
			)}
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Create</Dialog.Title>
					<Dialog.Description>
						Assign a name and description to your application
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form"
						onSubmit={form.handleSubmit(onSubmit)}
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
											placeholder="Frontend"
											{...field}
											onChange={(e) => {
												const val = e.target.value || "";
												const serviceName = slugify(val.trim());
												form.setValue("appName", `${slug}-${serviceName}`);
												field.onChange(val);
											}}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						{shouldShowServerDropdown && (
							<FormField
								control={form.control}
								name="serverId"
								render={({ field }) => (
									<FormItem>
										<TooltipProvider delay={0}>
											<Tooltip
												content={
													<>
														<span>
															Docklands uses automatic placement by default.
															Choose a worker only when this service needs
															manual placement.
														</span>
													</>
												}
												className="z-[999] w-[300px]"
												align="start"
												side="top"
												asChild
											>
												<FormLabel className="break-all w-fit flex flex-row gap-1 items-center">
													Placement {showLocalOption ? "(Optional)" : ""}
													<HelpCircle className="size-4 text-muted-foreground" />
												</FormLabel>
											</Tooltip>
										</TooltipProvider>

										<Select
											aria-label="Service placement"
											onValueChange={field.onChange}
											defaultValue={
												field.value ||
												(showLocalOption ? "docklands" : undefined)
											}
										>
											<></>
											<>
												<Select.Group>
													{showLocalOption && (
														<Select.Option value="docklands">
															<span className="flex items-center gap-2 justify-between w-full">
																<span>Automatic placement</span>
																<span className="text-muted-foreground text-xs self-center">
																	Default
																</span>
															</span>
														</Select.Option>
													)}
													{servers?.map((server) => (
														<Select.Option
															key={server.serverId}
															value={server.serverId}
														>
															<span className="flex items-center gap-2 justify-between w-full">
																<span>{server.name}</span>
																<span className="text-muted-foreground text-xs self-center">
																	{server.ipAddress}
																</span>
															</span>
														</Select.Option>
													))}
													<Select.GroupLabel>
														Runtime workers (
														{servers?.length + (showLocalOption ? 1 : 0)})
													</Select.GroupLabel>
												</Select.Group>
											</>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
						<FormField
							control={form.control}
							name="appName"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center gap-2">
										Service Name
										<TooltipProvider delay={0}>
											<Tooltip
												content={
													<>
														<p>Internal runtime service name.</p>
													</>
												}
												side="right"
												asChild
											>
												<HelpCircle className="size-4 text-muted-foreground" />
											</Tooltip>
										</TooltipProvider>
									</FormLabel>
									<FormControl>
										<Input placeholder="my-app" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Description of your service..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<div>
						<Button loading={isPending} form="hook-form" type="submit">
							Create
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
