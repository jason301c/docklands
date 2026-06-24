import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { createClientLogger } from "@/client/lib/logger";
import { GithubIcon } from "@/components/icons/data-tools-icons";
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
import { toast } from "@/components/shared/toast";

const Schema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	appName: z.string().min(1, {
		message: "App Name is required",
	}),
});

type Schema = z.infer<typeof Schema>;

const logger = createClientLogger("git-providers");

interface Props {
	githubId: string;
}

export const EditGithubProvider = ({ githubId }: Props) => {
	const { data: github } = api.github.one.useQuery(
		{
			githubId,
		},
		{
			enabled: !!githubId,
		},
	);
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const {
		mutate,
		error,
		isError,
		isPending: isUpdating,
	} = api.github.update.useMutation(
		crudMutationOptions({
			successMessage: "Github updated successfully",
			errorMessage: "Error updating Github",
			loggerScope: "git-providers",
			toastError: false,
			invalidate: () => utils.gitProvider.getAll.invalidate(),
			onSuccess: () => setIsOpen(false),
		}),
	);
	const { mutateAsync: testConnection, isPending } =
		api.github.testConnection.useMutation();
	const form = useForm<Schema>({
		defaultValues: {
			name: "",
			appName: "",
		},
		resolver: zodResolver(Schema),
	});

	useEffect(() => {
		form.reset({
			name: github?.gitProvider.name || "",
			appName: github?.githubAppName || "",
		});
	}, [form, isOpen]);

	const onSubmit = (data: Schema) => {
		mutate({
			githubId,
			name: data.name || "",
			gitProviderId: github?.gitProviderId || "",
			githubAppName: data.appName || "",
		});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Edit GitHub provider"
						variant="ghost"
						shape="square"
						className="group hover:bg-kumo-brand/10 "
					>
						<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl ">
				<Dialog.Header>
					<Dialog.Title className="flex items-center gap-2">
						Update Github <GithubIcon className="size-5" />
					</Dialog.Title>
				</Dialog.Header>

				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-github"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-1"
					>
						<div className="p-0">
							<div className="flex flex-col gap-4">
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
									name="appName"
									render={({ field }) => (
										<FormItem>
											<FormLabel>App Name</FormLabel>
											<FormControl>
												<Input
													placeholder="pp Name eg(my-personal)"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<Dialog.Footer className="w-full justify-between">
									<Button
										type="button"
										variant={"secondary"}
										loading={isPending}
										onClick={async () => {
											await testConnection({
												githubId,
											})
												.then(async (message) => {
													toast.info(`Message: ${message}`);
												})
												.catch((error) => {
													logger.error(
														"Error testing github connection",
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
								</Dialog.Footer>
							</div>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
