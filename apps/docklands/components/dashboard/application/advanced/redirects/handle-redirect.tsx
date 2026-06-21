import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "@/components/shared/toast";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Separator } from "@/components/shared/separator";
import { Switch } from "@cloudflare/kumo/components/switch";

const AddRedirectSchema = z.object({
	regex: z.string().min(1, "Regex required"),
	permanent: z.boolean().default(false),
	replacement: z.string().min(1, "Replacement required"),
});

type AddRedirect = z.infer<typeof AddRedirectSchema>;

// Default presets
const redirectPresets = [
	// {
	// 	label: "Allow www & non-www.",
	// 	redirect: {
	// 		regex: "",
	// 		permanent: false,
	// 		replacement: "",
	// 	},
	// },
	{
		id: "to-www",
		label: "Redirect to www",
		redirect: {
			regex: "^https?://(?:www.)?(.+)",
			permanent: true,
			replacement: "https://www.${1}",
		},
	},
	{
		id: "to-non-www",
		label: "Redirect to non-www",
		redirect: {
			regex: "^https?://www.(.+)",
			permanent: true,
			replacement: "https://${1}",
		},
	},
];

interface Props {
	applicationId: string;
	redirectId?: string;
	children?: React.ReactNode;
}

export const HandleRedirect = ({
	applicationId,
	redirectId,
	children = <PlusIcon className="w-4 h-4" />,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [presetSelected, setPresetSelected] = useState("");

	const { data, refetch } = api.redirects.one.useQuery(
		{
			redirectId: redirectId || "",
		},
		{
			enabled: !!redirectId,
		},
	);

	const utils = api.useUtils();

	const { mutateAsync, isPending, error, isError } = redirectId
		? api.redirects.update.useMutation()
		: api.redirects.create.useMutation();

	const form = useForm({
		defaultValues: {
			permanent: false,
			regex: "",
			replacement: "",
		},
		resolver: zodResolver(AddRedirectSchema),
	});

	useEffect(() => {
		form.reset({
			permanent: data?.permanent || false,
			regex: data?.regex || "",
			replacement: data?.replacement || "",
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: AddRedirect) => {
		await mutateAsync({
			applicationId,
			...data,
			redirectId: redirectId || "",
		})
			.then(async () => {
				toast.success(redirectId ? "Redirect Updated" : "Redirect Created");
				await utils.application.one.invalidate({
					applicationId,
				});
				refetch();
				await utils.application.readTraefikConfig.invalidate({
					applicationId,
				});
				onDialogToggle(false);
			})
			.catch(() => {
				toast.error(
					redirectId
						? "Error updating the redirect"
						: "Error creating the redirect",
				);
			});
	};

	const onDialogToggle = (open: boolean) => {
		setIsOpen(open);
		// commented for the moment because not resetting the form if accidentally closed the dialog can be considered as a feature instead of a bug
		// setPresetSelected("");
		// form.reset();
	};

	const onPresetSelect = (presetId: string) => {
		const redirectPreset = redirectPresets.find(
			(preset) => preset.id === presetId,
		)?.redirect;
		if (!redirectPreset) return;
		const { regex, permanent, replacement } = redirectPreset;
		form.reset({ regex, permanent, replacement }, { keepDefaultValues: true });
		setPresetSelected(presetId);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={onDialogToggle}>
			<Dialog.Trigger render={redirectId ? (
					<Button aria-label="Action"
						variant="ghost"
						shape="square"
						className="group hover:bg-blue-500/10 "
					>
						<PenBoxIcon className="size-3.5  text-primary group-hover:text-blue-500" />
					</Button>
				) : (
					<Button>{children}</Button>
				) as never} />
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Redirects</Dialog.Title>
					<Dialog.Description>
						Redirects are used to redirect requests to another url.
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<div className="md:col-span-2">
					<Label>Presets</Label>
					<Select
						aria-label="Select option"
						onValueChange={(value) =>
							value !== null && onPresetSelect(value)
						}
						value={presetSelected}
					>
						<>
							
						</>
						<>
							{redirectPresets.map((preset) => (
								<Select.Option key={preset.label} value={preset.id}>
									{preset.label}
								</Select.Option>
							))}
						</>
					</Select>
				</div>

				<Separator />

				<Form {...form}>
					<form
						id="hook-form-add-redirect"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="regex"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Regex</FormLabel>
										<FormControl>
											<Input placeholder="^http://localhost/(.*)" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="replacement"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Replacement</FormLabel>
										<FormControl>
											<Input placeholder="http://mydomain/$${1}" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="permanent"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
										<div className="space-y-0.5">
											<FormLabel>Permanent</FormLabel>
											<FormDescription>
												Set the permanent option to true to apply a permanent
												redirection.
											</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</form>

					<div>
						<Button
							loading={isPending}
							form="hook-form-add-redirect"
							type="submit"
						>
							{redirectId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
