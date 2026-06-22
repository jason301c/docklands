import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const organizationSchema = z.object({
	name: z.string().min(1, {
		message: "Organization name is required",
	}),
	logo: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationSchema>;

interface Props {
	organizationId?: string;
	children?: React.ReactNode;
}

export function AddOrganization({ organizationId }: Props) {
	const [open, setOpen] = useState(false);
	const utils = api.useUtils();
	const { data: organization } = api.organization.one.useQuery(
		{
			organizationId: organizationId ?? "",
		},
		{
			enabled: !!organizationId,
		},
	);
	const { mutateAsync, isPending } = organizationId
		? api.organization.update.useMutation()
		: api.organization.create.useMutation();

	const form = useForm<OrganizationFormValues>({
		resolver: zodResolver(organizationSchema),
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

	const onSubmit = async (values: OrganizationFormValues) => {
		await mutateAsync({
			name: values.name,
			logo: values.logo,
			organizationId: organizationId ?? "",
		})
			.then(() => {
				form.reset();
				toast.success(
					`Organization ${organizationId ? "updated" : "created"} successfully`,
				);
				utils.organization.all.invalidate();
				if (organizationId) {
					utils.organization.one.invalidate({ organizationId });
					utils.organization.active.invalidate();
				}
				setOpen(false);
			})
			.catch((error) => {
				console.error(error);
				toast.error(
					`Failed to ${organizationId ? "update" : "create"} organization`,
				);
			});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={
					organizationId ? (
						<DropdownMenu.Item
							className="group cursor-pointer hover:bg-blue-500/10"
							onSelect={(e) => e.preventDefault()}
						>
							<PenBoxIcon className="size-3.5 text-primary group-hover:text-blue-500" />
						</DropdownMenu.Item>
					) : (
						((
							<DropdownMenu.Item
								className="gap-2 p-2"
								onSelect={(e) => e.preventDefault()}
							>
								<div className="flex size-6 items-center justify-center rounded-md border bg-background">
									<Plus className="size-4" />
								</div>
								<div className="font-medium text-muted-foreground">
									Add organization
								</div>
							</DropdownMenu.Item>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-[425px]">
				<div>
					<Dialog.Title>
						{organizationId ? "Update organization" : "Add organization"}
					</Dialog.Title>
					<Dialog.Description>
						{organizationId
							? "Update the organization name and logo"
							: "Create a new organization to manage your workspaces."}
					</Dialog.Description>
				</div>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid gap-4 py-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem className="tems-center gap-4">
									<FormLabel className="text-right">Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Organization name"
											{...field}
											className="col-span-3"
										/>
									</FormControl>
									<FormMessage className="" />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="logo"
							render={({ field }) => (
								<FormItem className="gap-4">
									<FormLabel className="text-right">Logo URL</FormLabel>
									<FormControl>
										<Input
											placeholder="https://example.com/logo.png"
											{...field}
											value={field.value || ""}
											className="col-span-3"
										/>
									</FormControl>
									<FormMessage className="col-span-3 col-start-2" />
								</FormItem>
							)}
						/>
						<div>
							<Button type="submit" loading={isPending}>
								{organizationId ? "Update organization" : "Create organization"}
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
}
