import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { createClientLogger } from "@/client/lib/logger";
import { BitbucketIcon } from "@/components/icons/data-tools-icons";
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

const Schema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	username: z.string().min(1, {
		message: "Username is required",
	}),
	email: z.string().email({ message: "Email is required" }),
	workspaceName: z.string().optional(),
	apiToken: z.string().min(1, { message: "API Token is required" }),
});

type Schema = z.infer<typeof Schema>;

const logger = createClientLogger("git-providers");

interface Props {
	bitbucketId: string;
}

export const EditBitbucketProvider = ({ bitbucketId }: Props) => {
	const { data: bitbucket } = api.bitbucket.one.useQuery(
		{
			bitbucketId,
		},
		{
			enabled: !!bitbucketId,
		},
	);

	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const {
		mutate,
		error,
		isError,
		isPending: isUpdating,
	} = api.bitbucket.update.useMutation(
		crudMutationOptions({
			successMessage: "Bitbucket updated successfully",
			errorMessage: "Error updating Bitbucket",
			loggerScope: "git-providers",
			toastError: false,
			invalidate: () => utils.gitProvider.getAll.invalidate(),
			onSuccess: () => setIsOpen(false),
		}),
	);
	const { mutateAsync: testConnection, isPending } =
		api.bitbucket.testConnection.useMutation();
	const form = useForm<Schema>({
		defaultValues: {
			username: "",
			email: "",
			workspaceName: "",
			apiToken: "",
		},
		resolver: zodResolver(Schema),
	});

	const username = form.watch("username");
	const email = form.watch("email");
	const workspaceName = form.watch("workspaceName");
	const apiToken = form.watch("apiToken");

	useEffect(() => {
		form.reset({
			username: bitbucket?.bitbucketUsername || "",
			email: bitbucket?.bitbucketEmail || "",
			workspaceName: bitbucket?.bitbucketWorkspaceName || "",
			name: bitbucket?.gitProvider.name || "",
			apiToken: bitbucket?.apiToken || "",
		});
	}, [form, isOpen, bitbucket]);

	const onSubmit = (data: Schema) => {
		mutate({
			bitbucketId,
			gitProviderId: bitbucket?.gitProviderId || "",
			bitbucketUsername: data.username,
			bitbucketEmail: data.email || "",
			bitbucketWorkspaceName: data.workspaceName || "",
			name: data.name || "",
			apiToken: data.apiToken || "",
		});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit Bitbucket provider"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10 "
					>
						<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl ">
				<div>
					<Dialog.Title className="flex items-center gap-2">
						Update Bitbucket <BitbucketIcon className="size-5" />
					</Dialog.Title>
				</div>

				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-bitbucket"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-1"
					>
						<div className="p-0">
							<div className="flex flex-col gap-4">
								<p className="text-kumo-subtle text-sm">
									Update your Bitbucket authentication with an API token.
								</p>

								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Random Name eg(my-personal-account)"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="username"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Bitbucket Username</FormLabel>
											<FormControl>
												<Input
													placeholder="Your Bitbucket username"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Email (Required for API Tokens)</FormLabel>
											<FormControl>
												<Input
													type="email"
													placeholder="Your Bitbucket email address"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="workspaceName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Workspace Name (Optional)</FormLabel>
											<FormControl>
												<Input
													placeholder="For organization accounts"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="flex flex-col gap-2 border-t pt-4">
									<h3 className="text-sm font-medium mb-2">Authentication</h3>
									<FormField
										control={form.control}
										name="apiToken"
										render={({ field }) => (
											<FormItem>
												<FormLabel>API Token</FormLabel>
												<FormControl>
													<Input
														type="password"
														placeholder="Enter your Bitbucket API Token"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div className="flex w-full justify-between gap-4 mt-4">
									<Button
										type="button"
										variant={"secondary"}
										loading={isPending}
										onClick={async () => {
											await testConnection({
												bitbucketId,
												bitbucketUsername: username,
												bitbucketEmail: email,
												workspaceName: workspaceName,
												apiToken: apiToken,
											})
												.then(async (message) => {
													toast.info(`Message: ${message}`);
												})
												.catch((error) => {
													logger.error(
														"Error testing bitbucket connection",
														error,
													);
													toast.error(`Error: ${error.message}`);
												});
										}}
									>
										Test Connection
									</Button>
									<Button type="submit" loading={isUpdating}>
										Update
									</Button>
								</div>
							</div>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
