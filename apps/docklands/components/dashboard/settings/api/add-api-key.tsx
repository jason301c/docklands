import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const formSchema = z.object({
	name: z.string().min(1, "Name is required"),
	prefix: z.string().optional(),
	expiresIn: z.number().nullable(),
	// Rate limiting fields
	rateLimitEnabled: z.boolean().optional(),
	rateLimitTimeWindow: z.number().nullable(),
	rateLimitMax: z.number().nullable(),
	// Request limiting fields
	remaining: z.number().nullable().optional(),
	refillAmount: z.number().nullable().optional(),
	refillInterval: z.number().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const EXPIRATION_OPTIONS = [
	{ label: "Never", value: "0" },
	{ label: "1 day", value: String(60 * 60 * 24) },
	{ label: "7 days", value: String(60 * 60 * 24 * 7) },
	{ label: "30 days", value: String(60 * 60 * 24 * 30) },
	{ label: "90 days", value: String(60 * 60 * 24 * 90) },
	{ label: "1 year", value: String(60 * 60 * 24 * 365) },
];

const TIME_WINDOW_OPTIONS = [
	{ label: "1 minute", value: String(60 * 1000) },
	{ label: "5 minutes", value: String(5 * 60 * 1000) },
	{ label: "15 minutes", value: String(15 * 60 * 1000) },
	{ label: "30 minutes", value: String(30 * 60 * 1000) },
	{ label: "1 hour", value: String(60 * 60 * 1000) },
	{ label: "1 day", value: String(24 * 60 * 60 * 1000) },
];

const REFILL_INTERVAL_OPTIONS = [
	{ label: "1 hour", value: String(60 * 60 * 1000) },
	{ label: "6 hours", value: String(6 * 60 * 60 * 1000) },
	{ label: "12 hours", value: String(12 * 60 * 60 * 1000) },
	{ label: "1 day", value: String(24 * 60 * 60 * 1000) },
	{ label: "7 days", value: String(7 * 24 * 60 * 60 * 1000) },
	{ label: "30 days", value: String(30 * 24 * 60 * 60 * 1000) },
];

export const AddApiKey = () => {
	const [open, setOpen] = useState(false);
	const [showSuccessModal, setShowSuccessModal] = useState(false);
	const [newApiKey, setNewApiKey] = useState("");
	const { refetch } = api.user.get.useQuery();
	// Single-tenant: API keys are scoped to the one organization this instance
	// has, so there is no organization to pick — we resolve it automatically.
	const { data: organization } = api.organization.active.useQuery();
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

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			prefix: "",
			expiresIn: null,
			rateLimitEnabled: false,
			rateLimitTimeWindow: null,
			rateLimitMax: null,
			remaining: null,
			refillAmount: null,
			refillInterval: null,
		},
	});

	const rateLimitEnabled = form.watch("rateLimitEnabled");

	const onSubmit = async (values: FormValues) => {
		if (!organization) {
			toast.error("No active organization");
			return;
		}
		createApiKey.mutate({
			name: values.name,
			expiresIn: values.expiresIn || undefined,
			prefix: values.prefix || undefined,
			metadata: {
				organizationId: organization.id,
			},
			// Rate limiting
			rateLimitEnabled: values.rateLimitEnabled,
			rateLimitTimeWindow: values.rateLimitTimeWindow || undefined,
			rateLimitMax: values.rateLimitMax || undefined,
			// Request limiting
			remaining: values.remaining || undefined,
			refillAmount: values.refillAmount || undefined,
			refillInterval: values.refillInterval || undefined,
		});
	};

	return (
		<>
			<Dialog.Root open={open} onOpenChange={setOpen}>
				<Dialog.Trigger render={<Button>Generate New Key</Button>} />
				<Dialog className="sm:max-w-xl max-h-[90vh]">
					<Dialog.Header>
						<Dialog.Title>Generate API Key</Dialog.Title>
						<Dialog.Description>
							Create a new API key for accessing the API. You can set an
							expiration date and a custom prefix for better organization.
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
											<Input placeholder="My API Key" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="prefix"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Prefix</FormLabel>
										<FormControl>
											<Input placeholder="my_app" {...field} />
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
											value={field.value?.toString() || "0"}
											onValueChange={(value) => {
												if (value === null) return;
												field.onChange(Number.parseInt(value, 10));
											}}
										>
											<FormControl>
												<></>
											</FormControl>
											<>
												{EXPIRATION_OPTIONS.map((option) => (
													<Select.Option
														key={option.value}
														value={option.value}
													>
														{option.label}
													</Select.Option>
												))}
											</>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							{/* Rate Limiting Section */}
							<div className="space-y-4 rounded-lg border p-4">
								<h3 className="text-lg font-medium">Rate Limiting</h3>
								<FormField
									control={form.control}
									name="rateLimitEnabled"
									render={({ field }) => (
										<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
											<div className="space-y-0.5">
												<FormLabel>Enable Rate Limiting</FormLabel>
												<FormDescription>
													Limit the number of requests within a time window
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

								{rateLimitEnabled && (
									<>
										<FormField
											control={form.control}
											name="rateLimitTimeWindow"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Time Window</FormLabel>
													<Select
														aria-label="Rate limit time window"
														value={field.value?.toString()}
														onValueChange={(value) => {
															if (value === null) return;
															field.onChange(Number.parseInt(value, 10));
														}}
													>
														<FormControl>
															<></>
														</FormControl>
														<>
															{TIME_WINDOW_OPTIONS.map((option) => (
																<Select.Option
																	key={option.value}
																	value={option.value}
																>
																	{option.label}
																</Select.Option>
															))}
														</>
													</Select>
													<FormDescription>
														The duration in which requests are counted
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="rateLimitMax"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Maximum Requests</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="100"
															value={field.value?.toString() ?? ""}
															onChange={(e) =>
																field.onChange(
																	e.target.value
																		? Number.parseInt(e.target.value, 10)
																		: null,
																)
															}
														/>
													</FormControl>
													<FormDescription>
														Maximum number of requests allowed within the time
														window
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									</>
								)}
							</div>

							{/* Request Limiting Section */}
							<div className="space-y-4 rounded-lg border p-4">
								<h3 className="text-lg font-medium">Request Limiting</h3>
								<FormField
									control={form.control}
									name="remaining"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Total Request Limit</FormLabel>
											<FormControl>
												<Input
													type="number"
													placeholder="Leave empty for unlimited"
													value={field.value?.toString() ?? ""}
													onChange={(e) =>
														field.onChange(
															e.target.value
																? Number.parseInt(e.target.value, 10)
																: null,
														)
													}
												/>
											</FormControl>
											<FormDescription>
												Total number of requests allowed (leave empty for
												unlimited)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="refillAmount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Refill Amount</FormLabel>
											<FormControl>
												<Input
													type="number"
													placeholder="Amount to refill"
													value={field.value?.toString() ?? ""}
													onChange={(e) =>
														field.onChange(
															e.target.value
																? Number.parseInt(e.target.value, 10)
																: null,
														)
													}
												/>
											</FormControl>
											<FormDescription>
												Number of requests to add on each refill
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="refillInterval"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Refill Interval</FormLabel>
											<Select
												aria-label="Request refill interval"
												value={field.value?.toString()}
												onValueChange={(value) => {
													if (value === null) return;
													field.onChange(Number.parseInt(value, 10));
												}}
											>
												<FormControl>
													<></>
												</FormControl>
												<>
													{REFILL_INTERVAL_OPTIONS.map((option) => (
														<Select.Option
															key={option.value}
															value={option.value}
														>
															{option.label}
														</Select.Option>
													))}
												</>
											</Select>
											<FormDescription>
												How often to refill the request limit
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Dialog.Footer>
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit">Generate</Button>
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
