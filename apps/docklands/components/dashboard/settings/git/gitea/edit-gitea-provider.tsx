import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { getGiteaOAuthUrl } from "@/client/git/gitea";
import { useUrl } from "@/client/hooks/use-url";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	giteaUrl: z.string().min(1, "Gitea URL is required"),
	giteaInternalUrl: z
		.union([z.string().url(), z.literal("")])
		.optional()
		.transform((v) => (v === "" ? undefined : v)),
	clientId: z.string().min(1, "Client ID is required"),
	clientSecret: z.string().min(1, "Client Secret is required"),
});

interface Props {
	giteaId: string;
}

export const EditGiteaProvider = ({ giteaId }: Props) => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPathname = pathname ?? "/dashboard/settings/git-providers";
	const [open, setOpen] = useState(false);
	const {
		data: gitea,
		isLoading,
		refetch,
	} = api.gitea.one.useQuery({ giteaId });
	const { mutate, isPending: isUpdating } = api.gitea.update.useMutation(
		crudMutationOptions({
			successMessage: "Gitea provider updated successfully",
			errorMessage: "Error updating Gitea provider",
			loggerScope: "git-providers",
			invalidate: () => utils.gitProvider.getAll.invalidate(),
			onSuccess: async () => {
				await refetch();
				setOpen(false);
			},
		}),
	);
	const { mutateAsync: testConnection, isPending: isTesting } =
		api.gitea.testConnection.useMutation();
	const url = useUrl();
	const utils = api.useUtils();

	useEffect(() => {
		const connected = searchParams?.get("connected");
		const error = searchParams?.get("error");

		if (connected) {
			toast.success("Successfully connected to Gitea", {
				description: "Your Gitea provider has been authorized.",
				id: "gitea-connection-success",
			});
			refetch();
			router.replace(currentPathname, { scroll: false });
		}

		if (error) {
			toast.error("Gitea Connection Failed", {
				description: decodeURIComponent(error),
				id: "gitea-connection-error",
			});
			router.replace(currentPathname, { scroll: false });
		}
	}, [currentPathname, refetch, router, searchParams]);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			giteaUrl: "https://gitea.com",
			giteaInternalUrl: "",
			clientId: "",
			clientSecret: "",
		},
	});

	useEffect(() => {
		if (gitea) {
			form.reset({
				name: gitea.gitProvider?.name || "",
				giteaUrl: gitea.giteaUrl || "https://gitea.com",
				giteaInternalUrl: gitea.giteaInternalUrl || "",
				clientId: gitea.clientId || "",
				clientSecret: gitea.clientSecret || "",
			});
		}
	}, [gitea, form]);

	const onSubmit = (values: z.infer<typeof formSchema>) => {
		mutate({
			giteaId: giteaId,
			gitProviderId: gitea?.gitProvider?.gitProviderId || "",
			name: values.name,
			giteaUrl: values.giteaUrl,
			giteaInternalUrl: values.giteaInternalUrl ?? null,
			clientId: values.clientId,
			clientSecret: values.clientSecret,
		});
	};

	const handleTestConnection = async () => {
		try {
			const result = await testConnection({ giteaId });
			toast.success("Gitea Connection Verified", {
				description: result,
			});
		} catch (error: any) {
			const formValues = form.getValues();
			const authUrl =
				error.authorizationUrl ||
				getGiteaOAuthUrl(
					giteaId,
					formValues.clientId,
					formValues.giteaUrl,
					typeof url === "string" ? url : (url as any).url || "",
				);

			toast.error("Gitea Not Connected", {
				description:
					error.message || "Please complete the OAuth authorization process.",
				actions:
					authUrl && authUrl !== "#"
						? [
								{
									children: "Authorize Now",
									onClick: () => {
										window.open(authUrl, "_blank");
									},
								},
							]
						: undefined,
			});
		}
	};

	if (isLoading) {
		return (
			<Button
				aria-label="Edit Gitea provider"
				variant="ghost"
				shape="square"
				disabled
			>
				<PenBoxIcon className="h-4 w-4 text-kumo-subtle" />
			</Button>
		);
	}

	// Function to handle dialog open state
	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit Gitea provider"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10"
					>
						<PenBoxIcon className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>Edit Gitea Provider</Dialog.Title>
					<Dialog.Description>
						Update your Gitea provider details.
					</Dialog.Description>
				</Dialog.Header>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											placeholder="My Gitea"
											{...field}
											autoFocus={false}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="giteaUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Gitea URL</FormLabel>
									<FormControl>
										<Input placeholder="https://gitea.example.com" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="giteaInternalUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Internal URL (Optional)</FormLabel>
									<FormControl>
										<Input
											placeholder="http://gitea:3000"
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										Use when Gitea runs on the same instance as Docklands. Used
										for OAuth token exchange to reach Gitea via internal network
										(e.g. Docker service name).
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="clientId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Client ID</FormLabel>
									<FormControl>
										<Input placeholder="Client ID" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="clientSecret"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Client Secret</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Client Secret"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Dialog.Footer>
							<Button
								type="button"
								variant="outline"
								onClick={handleTestConnection}
								loading={isTesting}
							>
								Test Connection
							</Button>

							<Button
								type="button"
								variant="outline"
								onClick={() => {
									const formValues = form.getValues();
									const authUrl = getGiteaOAuthUrl(
										giteaId,
										formValues.clientId,
										formValues.giteaUrl,
										typeof url === "string" ? url : (url as any).url || "",
									);
									if (authUrl !== "#") {
										window.open(authUrl, "_blank");
									}
								}}
							>
								Connect to Gitea
							</Button>

							<Button type="submit" loading={isUpdating}>
								Save
							</Button>
						</Dialog.Footer>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
