import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CircuitBoard } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";
import { slugify } from "@/shared/slug";
import { APP_NAME_MESSAGE, APP_NAME_REGEX } from "@/shared/validation/schema";
import { PlacementFormField } from "./placement-select";

const logger = createClientLogger("workspace");

const AddComposeSchema = z.object({
	composeType: z.enum(["docker-compose", "stack"]).optional(),
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
	runtimeWorkerId: z.string().optional(),
});

type AddCompose = z.infer<typeof AddComposeSchema>;

interface Props {
	environmentId: string;
	projectName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	hideTrigger?: boolean;
}

export const AddCompose = ({
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
	const slug = slugify(projectName);
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const showLocalOption = !webServerSettings?.remoteServersOnly;
	const { data: servers } = api.runtimeWorker.withSSHKey.useQuery();
	const { mutateAsync, isPending, error, isError } =
		api.compose.create.useMutation();

	const hasServers = servers && servers.length > 0;
	// Show placement only when there is more than the local runtime to choose.
	const shouldShowServerDropdown = hasServers;

	const form = useForm<AddCompose>({
		defaultValues: {
			name: "",
			description: "",
			composeType: "docker-compose",
			appName: `${slug}-`,
		},
		resolver: zodResolver(AddComposeSchema),
	});

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (data: AddCompose) => {
		await mutateAsync({
			name: data.name,
			description: data.description,
			environmentId,
			composeType: data.composeType,
			appName: data.appName,
			runtimeWorkerId:
				data.runtimeWorkerId === "docklands" ? undefined : data.runtimeWorkerId,
		})
			.then(async () => {
				toast.success("Compose Created");
				setVisible(false);
				// Refresh the workspace environment data.
				await utils.environment.one.invalidate({
					environmentId,
				});
				// Refresh workspace data for the breadcrumb.
				await utils.workspaces.all.invalidate();
			})
			.catch((err) => {
				logger.error("Error creating the compose", err);
				toast.error("Error creating the compose");
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
						<CircuitBoard className="size-4 text-kumo-subtle" />
						<span>Compose</span>
					</DropdownMenu.Item>
				</Dialog.Trigger>
			)}
			<Dialog className="sm:max-w-xl">
				<Dialog.Header>
					<Dialog.Title>Create Compose</Dialog.Title>
					<Dialog.Description>
						Assign a name and description to your compose
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
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
						</div>
						{shouldShowServerDropdown && (
							<PlacementFormField
								control={form.control}
								name="runtimeWorkerId"
								ariaLabel="Compose placement"
								workers={servers}
								showAutomaticPlacement={showLocalOption}
								optional={showLocalOption}
								description="Docklands uses automatic placement by default. Choose a runtime worker only when this stack needs manual placement."
							/>
						)}
						<FormField
							control={form.control}
							name="appName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Service Name</FormLabel>
									<FormControl>
										<Input placeholder="my-app" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="composeType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Compose Type</FormLabel>
									<Select
										aria-label="Compose type"
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<></>
										</FormControl>
										<>
											<Select.Option value="docker-compose">
												Docker Compose
											</Select.Option>
											<Select.Option value="stack">Stack</Select.Option>
										</>
									</Select>
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

					<Dialog.Footer>
						<Button loading={isPending} form="hook-form" type="submit">
							Create
						</Button>
					</Dialog.Footer>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
