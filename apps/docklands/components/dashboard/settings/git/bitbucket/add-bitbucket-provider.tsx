import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { BitbucketIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";

const Schema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	username: z.string().min(1, { message: "Username is required" }),
	email: z.string().email({ message: "Email is required" }),
	apiToken: z.string().min(1, { message: "API Token is required" }),
	workspaceName: z.string().optional(),
});

type Schema = z.infer<typeof Schema>;

export const AddBitbucketProvider = () => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const { mutate, error, isError, isPending } =
		api.bitbucket.create.useMutation(
			crudMutationOptions({
				successMessage: "Bitbucket configured successfully",
				errorMessage: "Error configuring Bitbucket",
				loggerScope: "git-providers",
				toastError: false,
				invalidate: () => utils.gitProvider.getAll.invalidate(),
				onSuccess: () => setIsOpen(false),
			}),
		);
	const { data: auth } = api.user.get.useQuery();
	const form = useForm<Schema>({
		defaultValues: {
			username: "",
			apiToken: "",
			workspaceName: "",
		},
		resolver: zodResolver(Schema),
	});

	useEffect(() => {
		form.reset({
			username: "",
			email: "",
			apiToken: "",
			workspaceName: "",
		});
	}, [form, isOpen]);

	const onSubmit = (data: Schema) => {
		mutate({
			bitbucketUsername: data.username,
			apiToken: data.apiToken,
			bitbucketWorkspaceName: data.workspaceName || "",
			authId: auth?.id || "",
			name: data.name || "",
			bitbucketEmail: data.email || "",
		});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						variant="secondary"
						className="flex items-center space-x-1 bg-kumo-info text-kumo-inverse hover:bg-kumo-info"
					>
						<BitbucketIcon />
						<span>Bitbucket</span>
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl ">
				<Dialog.Header>
					<Dialog.Title className="flex items-center gap-2">
						Bitbucket Provider <BitbucketIcon className="size-5" />
					</Dialog.Title>
				</Dialog.Header>

				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-bitbucket"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-1"
					>
						<div className="p-0">
							<div className="flex flex-col gap-4">
								<AlertBlock type="info">
									Use a Bitbucket API token with repository, pull request,
									webhook, and workspace scopes.
								</AlertBlock>

								<div className="mt-1 text-sm">
									Manage tokens in
									<Link
										href="https://id.atlassian.com/manage-profile/security/api-tokens"
										target="_blank"
										className="inline-flex items-center gap-1 ml-1"
									>
										<span>Bitbucket settings</span>
										<ExternalLink className="w-fit text-kumo-brand size-4" />
									</Link>
								</div>
								<ul className="list-disc list-inside ml-4 text-sm text-kumo-subtle">
									<li className="text-kumo-subtle text-sm">
										Click on Create API token with scopes
									</li>
									<li className="text-kumo-subtle text-sm">
										Select the expiration date (Max 1 year)
									</li>
									<li className="text-kumo-subtle text-sm">
										Select Bitbucket product.
									</li>
								</ul>
								<p className="text-kumo-subtle text-sm">
									Select the following scopes:
								</p>

								<ul className="list-disc list-inside ml-4 text-sm text-kumo-subtle">
									<li>read:repository:bitbucket</li>
									<li>read:pullrequest:bitbucket</li>
									<li>read:workspace:bitbucket</li>
								</ul>

								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Your Bitbucket Provider, eg: my-personal-account"
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
											<FormLabel>Bitbucket Email</FormLabel>
											<FormControl>
												<Input placeholder="Your Bitbucket email" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="apiToken"
									render={({ field }) => (
										<FormItem>
											<FormLabel>API Token</FormLabel>
											<FormControl>
												<Input
													placeholder="Paste your Bitbucket API token"
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
											<FormLabel>Workspace Name (optional)</FormLabel>
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

								<Button loading={isPending}>Configure Bitbucket</Button>
							</div>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
