import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { HelpCircle, PlusIcon, SquarePen } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
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

const certificateDataHolder =
	"-----BEGIN CERTIFICATE-----\nMIIFRDCCAyygAwIBAgIUEPOR47ys6VDwMVB9tYoeEka83uQwDQYJKoZIhvcNAQELBQAwGTEXMBUGA1UEAwwObWktZG9taW5pby5jb20wHhcNMjQwMzExMDQyNzU3WhcN\n------END CERTIFICATE-----";

const privateKeyDataHolder =
	"-----BEGIN PRIVATE KEY-----\nMIIFRDCCAyygAwIBAgIUEPOR47ys6VDwMVB9tYoeEka83uQwDQYJKoZIhvcNAQELBQAwGTEXMBUGA1UEAwwObWktZG9taW5pby5jb20wHhcNMjQwMzExMDQyNzU3WhcN\n-----END PRIVATE KEY-----";

const handleCertificateSchema = z.object({
	name: z.string().min(1, "Name is required"),
	certificateData: z.string().min(1, "Certificate data is required"),
	privateKey: z.string().min(1, "Private key is required"),
	runtimeWorkerId: z.string().optional(),
});

type HandleCertificateForm = z.infer<typeof handleCertificateSchema>;

interface Props {
	certificateId?: string;
}

export const HandleCertificate = ({ certificateId }: Props) => {
	const [open, setOpen] = useState(false);
	const utils = api.useUtils();

	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: servers } = api.runtimeWorker.withSSHKey.useQuery();
	const hasServers = servers && servers.length > 0;
	const shouldShowServerDropdown = hasServers && !certificateId; // Hide on edit

	const { data: existingCert, refetch } = api.certificates.one.useQuery(
		{ certificateId: certificateId || "" },
		{ enabled: !!certificateId },
	);

	const createMutation = api.certificates.create.useMutation();
	const updateMutation = api.certificates.update.useMutation();
	const mutation = certificateId ? updateMutation : createMutation;
	const { mutateAsync, isError, error, isPending } = mutation;

	const form = useForm<HandleCertificateForm>({
		defaultValues: {
			name: "",
			certificateData: "",
			privateKey: "",
		},
		resolver: zodResolver(handleCertificateSchema),
	});

	useEffect(() => {
		if (existingCert) {
			form.reset({
				name: existingCert.name,
				certificateData: existingCert.certificateData,
				privateKey: existingCert.privateKey,
			});
		} else {
			form.reset({
				name: "",
				certificateData: "",
				privateKey: "",
			});
		}
	}, [existingCert, form, open]);

	const onSubmit = async (data: HandleCertificateForm) => {
		const basePayload = {
			name: data.name,
			certificateData: data.certificateData,
			privateKey: data.privateKey,
		};

		const promise = certificateId
			? updateMutation.mutateAsync({
					certificateId,
					...basePayload,
				})
			: createMutation.mutateAsync({
					...basePayload,
					runtimeWorkerId:
						data.runtimeWorkerId === "docklands"
							? undefined
							: data.runtimeWorkerId,
					organizationId: "",
				});

		await promise
			.then(async () => {
				toast.success(
					certificateId ? "Certificate Updated" : "Certificate Created",
				);
				await utils.certificates.all.invalidate();
				if (certificateId) {
					refetch();
				}
				setOpen(false);
			})
			.catch(() => {
				toast.error(
					certificateId
						? "Error updating the Certificate"
						: "Error creating the Certificate",
				);
			});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={
					certificateId ? (
						<Button
							aria-label="Edit certificate"
							variant="ghost"
							shape="square"
							className="group hover:bg-blue-500/10"
						>
							<SquarePen className="size-3.5 text-primary group-hover:text-blue-500" />
						</Button>
					) : (
						((
							<Button>
								<PlusIcon className="h-4 w-4" />
								Add Certificate
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>
						{certificateId ? "Update" : "Add New"} Certificate
					</Dialog.Title>
					<Dialog.Description>
						{certificateId
							? "Modify the certificate details"
							: "Upload or generate a certificate to secure your application"}
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-handle-certificate"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Certificate Name</FormLabel>
									<FormControl>
										<Input placeholder="My Certificate" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="certificateData"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Certificate Data</FormLabel>
									<FormControl>
										<Textarea
											className="h-32"
											placeholder={certificateDataHolder}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="privateKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Private Key</FormLabel>
									<FormControl>
										<Textarea
											className="h-32"
											placeholder={privateKeyDataHolder}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						{shouldShowServerDropdown && (
							<FormField
								control={form.control}
								name="runtimeWorkerId"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="break-all w-fit flex flex-row gap-1 items-center">
											Placement {!isCloud && "(Optional)"}
											<HelpCircle className="size-4 text-muted-foreground" />
										</FormLabel>

										<Select
											aria-label="Certificate placement"
											onValueChange={field.onChange}
											defaultValue={
												field.value || (!isCloud ? "docklands" : undefined)
											}
										>
											<></>
											<>
												<Select.Group>
													{!isCloud && (
														<Select.Option value="docklands">
															<span className="flex items-center gap-2 justify-between w-full">
																<span>Automatic placement</span>
																<span className="text-muted-foreground text-xs self-center">
																	Default
																</span>
															</span>
														</Select.Option>
													)}
													{servers?.map((runtimeWorker) => (
														<Select.Option
															key={runtimeWorker.runtimeWorkerId}
															value={runtimeWorker.runtimeWorkerId}
														>
															<span className="flex items-center gap-2 justify-between w-full">
																<span>{runtimeWorker.name}</span>
																<span className="text-muted-foreground text-xs self-center">
																	{runtimeWorker.ipAddress}
																</span>
															</span>
														</Select.Option>
													))}
													<Select.GroupLabel>
														Runtime workers (
														{servers?.length + (!isCloud ? 1 : 0)})
													</Select.GroupLabel>
												</Select.Group>
											</>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
					</form>

					<div className="flex w-full flex-row !justify-end">
						<Button
							loading={isPending}
							form="hook-form-handle-certificate"
							type="submit"
						>
							{certificateId ? "Update" : "Create"}
						</Button>
					</div>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
