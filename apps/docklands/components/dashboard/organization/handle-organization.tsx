import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
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

const logger = createClientLogger("organization");

const instanceSchema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	logo: z.string().optional(),
});

type InstanceFormValues = z.infer<typeof instanceSchema>;

/**
 * Edit the single organization's name and logo — i.e. the instance's display
 * identity in the sidebar. Docklands is single-tenant, so there is no create /
 * switch / delete: this only renames the one organization the instance has.
 */
export function EditInstance() {
	const [open, setOpen] = useState(false);
	const utils = api.useUtils();
	const { data: organization } = api.organization.active.useQuery();
	const { mutateAsync, isPending } = api.organization.update.useMutation();

	const form = useForm<InstanceFormValues>({
		resolver: zodResolver(instanceSchema),
		defaultValues: {
			name: "",
			logo: "",
		},
	});

	useEffect(() => {
		if (organization) {
			form.reset({
				name: organization.name,
				logo: organization.logo || "",
			});
		}
	}, [organization, form]);

	const onSubmit = async (values: InstanceFormValues) => {
		await mutateAsync({
			name: values.name,
			logo: values.logo,
		})
			.then(() => {
				toast.success("Instance settings updated");
				utils.organization.active.invalidate();
				setOpen(false);
			})
			.catch((error) => {
				logger.error(error);
				toast.error(error?.message || "Failed to update instance settings");
			});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={
					<Button
						variant="ghost"
						shape="square"
						aria-label="Instance settings"
						title="Instance settings"
						className="group shrink-0 hover:bg-kumo-brand/10"
					>
						<PenBoxIcon className="size-4 text-kumo-subtle group-hover:text-kumo-brand" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-[425px]">
				<Dialog.Header>
					<Dialog.Title>Instance settings</Dialog.Title>
					<Dialog.Description>
						Update the name and logo shown for this Docklands instance.
					</Dialog.Description>
				</Dialog.Header>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="gap-4">
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="Instance name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="logo"
							render={({ field }) => (
								<FormItem className="gap-4">
									<FormLabel>Logo URL</FormLabel>
									<FormControl>
										<Input
											placeholder="https://example.com/logo.png"
											{...field}
											value={field.value || ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Dialog.Footer>
							<Button type="submit" loading={isPending}>
								Save changes
							</Button>
						</Dialog.Footer>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
}
