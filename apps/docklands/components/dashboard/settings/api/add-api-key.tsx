import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";
import { Dialog } from "@/components/shared/dialog";
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

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	// Seconds until the key expires; 0 means it never expires.
	expiresIn: z.number(),
});

type FormValues = z.infer<typeof formSchema>;

const DAY = 60 * 60 * 24;

const EXPIRATION_OPTIONS = [
	{ label: "Never", value: "0" },
	{ label: "30 days", value: String(DAY * 30) },
	{ label: "90 days", value: String(DAY * 90) },
	{ label: "1 year", value: String(DAY * 365) },
];

export const AddApiKey = () => {
	const [open, setOpen] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [newApiKey, setNewApiKey] = useState("");
	const { refetch } = api.user.get.useQuery();
	// Single-tenant: API keys are scoped to the one organization this instance
	// has, so there is no organization to pick — we resolve it automatically.
	const { data: organization } = api.organization.active.useQuery();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: "", expiresIn: 0 },
	});

	const createApiKey = api.user.createApiKey.useMutation({
		onSuccess: (data) => {
			if (!data) return;
			setNewApiKey(data.key);
			setOpen(false);
			setShowSuccessModal(true);
			form.reset();
			void refetch();
		},
		onError: () => {
			toast.error("Failed to generate API key");
		},
	});

	const onSubmit = (values: FormValues) => {
		if (!organization) {
			toast.error("No active organization");
			return;
		}
		createApiKey.mutate({
			name: values.name,
			expiresIn: values.expiresIn || undefined,
			metadata: { organizationId: organization.id },
		});
	};

	return (
		<>
			<Dialog.Root open={open} onOpenChange={setOpen}>
				<Dialog.Trigger render={<Button>Generate New Key</Button>} />
				<Dialog className="sm:max-w-md">
					<Dialog.Header>
						<Dialog.Title>Generate API key</Dialog.Title>
						<Dialog.Description>
							Name the key so you can recognize it later, then choose how long
							it stays valid.
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
											<Input placeholder="e.g. CI deploy bot" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="expiresIn"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Expiration</FormLabel>
										<Select
											aria-label="API key expiration"
											value={String(field.value ?? 0)}
											onValueChange={(value) =>
												field.onChange(
													value ? Number.parseInt(String(value), 10) : 0,
												)
											}
											items={EXPIRATION_OPTIONS}
										/>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Dialog.Footer>
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" loading={createApiKey.isPending}>
									Generate
								</Button>
							</Dialog.Footer>
						</form>
					</Form>
				</Dialog>
			</Dialog.Root>

			<Dialog.Root open={showSuccessModal} onOpenChange={setShowSuccessModal}>
				<Dialog className="sm:max-w-xl">
					<Dialog.Header>
						<Dialog.Title>API Key Generated Successfully</Dialog.Title>
						<Dialog.Description>
							Please copy your API key now. You won't be able to see it again!
						</Dialog.Description>
					</Dialog.Header>
					<CodeEditor
						className="font-mono text-sm break-all"
						language="properties"
						value={newApiKey}
						readOnly
					/>
					<Dialog.Footer>
						<Button
							onClick={() => {
								copy(newApiKey);
								toast.success("API key copied to clipboard");
							}}
						>
							Copy to Clipboard
						</Button>
						<Button
							variant="outline"
							onClick={() => setShowSuccessModal(false)}
						>
							Close
						</Button>
					</Dialog.Footer>
				</Dialog>
			</Dialog.Root>
		</>
	);
};
