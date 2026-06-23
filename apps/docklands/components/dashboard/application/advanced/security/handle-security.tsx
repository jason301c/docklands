import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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

const logger = createClientLogger("application");

const AddSecuritychema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
});

type AddSecurity = z.infer<typeof AddSecuritychema>;

interface Props {
	applicationId: string;
	securityId?: string;
	children?: React.ReactNode;
}

export const HandleSecurity = ({
	applicationId,
	securityId,
	children = <PlusIcon className="h-4 w-4" />,
}: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const { data, refetch } = api.security.one.useQuery(
		{
			securityId: securityId ?? "",
		},
		{
			enabled: !!securityId,
		},
	);

	const updateSecurity = api.security.update.useMutation();
	const createSecurity = api.security.create.useMutation();
	const { mutateAsync, isPending, error, isError } = securityId
		? updateSecurity
		: createSecurity;

	const form = useForm<AddSecurity>({
		defaultValues: {
			username: "",
			password: "",
		},
		resolver: zodResolver(AddSecuritychema),
	});

	useEffect(() => {
		form.reset({
			username: data?.username || "",
			password: data?.password || "",
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: AddSecurity) => {
		await mutateAsync({
			applicationId,
			...data,
			securityId: securityId || "",
		})
			.then(async () => {
				toast.success(securityId ? "Security Updated" : "Security Created");
				await utils.application.one.invalidate({
					applicationId,
				});
				await utils.application.readTraefikConfig.invalidate({
					applicationId,
				});
				await refetch();
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error(
					securityId
						? "Failed to update the security"
						: "Failed to create security",
					err,
				);
				toast.error(
					securityId
						? "Error updating the security"
						: "Error creating security",
				);
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					securityId ? (
						<Button
							aria-label="Edit security rule"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 "
						>
							<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((<Button>{children}</Button>) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Security</Dialog.Title>
					<Dialog.Description>
						{securityId ? "Update" : "Add"} security to your application
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-add-security"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Username</FormLabel>
										<FormControl>
											<Input placeholder="test1" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input placeholder="test" type="password" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</form>

					<div>
						<Button
							loading={isPending}
							form="hook-form-add-security"
							type="submit"
						>
							{securityId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
