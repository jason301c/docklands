import { Button } from "@cloudflare/kumo/components/button";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { DownloadIcon, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";

const logger = createClientLogger("ssh-keys");

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";
import { sshKeyCreate, type sshKeyType } from "@/shared/validations";

type SSHKey = z.infer<typeof sshKeyCreate>;

interface Props {
	sshKeyId?: string;
}

export const HandleSSHKeys = ({ sshKeyId }: Props) => {
	const utils = api.useUtils();

	const [isOpen, setIsOpen] = useState(false);

	const { data } = api.sshKey.one.useQuery(
		{
			sshKeyId: sshKeyId || "",
		},
		{
			enabled: !!sshKeyId,
		},
	);

	const updateSSHKey = api.sshKey.update.useMutation();
	const createSSHKey = api.sshKey.create.useMutation();
	const { mutateAsync, isError, error, isPending } = sshKeyId
		? updateSSHKey
		: createSSHKey;

	const generateMutation = api.sshKey.generate.useMutation();

	const form = useForm<SSHKey>({
		resolver: zodResolver(sshKeyCreate),
		defaultValues: {
			name: "",
			description: "",
			publicKey: "",
			privateKey: "",
		},
	});

	useEffect(() => {
		if (data) {
			form.reset({
				...data,
				description: data.description || undefined,
			});
		} else {
			form.reset();
		}
	}, [data, form, form.reset]);

	const onSubmit = async (data: SSHKey) => {
		await mutateAsync({
			...data,
			organizationId: "",
			sshKeyId: sshKeyId || "",
		})
			.then(async () => {
				toast.success(
					sshKeyId
						? "SSH key updated successfully"
						: "SSH key created successfully",
				);
				await utils.sshKey.all.invalidate();
				form.reset();
				setIsOpen(false);
			})
			.catch((err) => {
				logger.error(err);
				toast.error(
					sshKeyId
						? "Error updating the SSH key"
						: "Error creating the SSH key",
				);
			});
	};

	const onGenerateSSHKey = (type: z.infer<typeof sshKeyType>) =>
		generateMutation
			.mutateAsync(type)
			.then(async (data) => {
				toast.success("SSH Key Generated");
				form.setValue("privateKey", data.privateKey);
				form.setValue("publicKey", data.publicKey);
			})
			.catch((err) => {
				logger.error(err);
				toast.error("Error generating the SSH Key");
			});

	const downloadKey = (content: string, keyType: "private" | "public") => {
		const keyName = form.watch("name");
		const publicKey = form.watch("publicKey");

		// Extract algorithm type from public key
		const isEd25519 = publicKey.startsWith("ssh-ed25519");
		const defaultName = isEd25519 ? "id_ed25519" : "id_rsa";

		const filename = keyName
			? `${keyName}${sshKeyId ? `_${sshKeyId}` : ""}_${keyType}_${defaultName}${keyType === "public" ? ".pub" : ""}`
			: `${defaultName}${keyType === "public" ? ".pub" : ""}`;
		const blob = new Blob([content], { type: "text/plain" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				className=""
				render={
					sshKeyId ? (
						<Button
							aria-label="Edit SSH key"
							variant="ghost"
							shape="square"
							className="group hover:bg-kumo-brand/10 "
						>
							<PenBoxIcon className="size-3.5  text-kumo-brand group-hover:text-kumo-brand" />
						</Button>
					) : (
						((
							<Button variant="primary" className="cursor-pointer space-x-3">
								<PlusIcon className="h-4 w-4" />
								Add SSH Key
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<Dialog.Header>
					<Dialog.Title>SSH Key</Dialog.Title>
					<Dialog.Description>
						In this section you can add one of your keys or generate a new one.
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						className="grid w-full gap-4 "
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder={"Personal workloads"} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Input
												placeholder={"Used on my personal Hetzner VPS"}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								);
							}}
						/>
						<FormField
							control={form.control}
							name="privateKey"
							render={({ field }) => (
								<FormItem>
									<div className="space-y-0.5">
										<FormLabel>Private Key</FormLabel>
									</div>
									<FormControl>
										<Textarea
											placeholder={"-----BEGIN RSA PRIVATE KEY-----"}
											rows={5}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="publicKey"
							render={({ field }) => (
								<FormItem>
									<div className="space-y-0.5">
										<FormLabel>Public Key</FormLabel>
									</div>
									<FormControl>
										<Input placeholder={"ssh-rsa AAAAB3NzaC1yc2E"} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Dialog.Footer className="flex-col items-stretch gap-4">
							<div className="flex flex-col gap-3">
								{!sshKeyId && (
									<div className="flex flex-wrap items-center gap-3">
										<Button
											variant="secondary"
											disabled={generateMutation.isPending}
											onClick={() =>
												onGenerateSSHKey({
													type: "rsa",
												})
											}
											type="button"
										>
											Generate RSA SSH Key
										</Button>
										<Button
											variant="secondary"
											disabled={generateMutation.isPending}
											onClick={() =>
												onGenerateSSHKey({
													type: "ed25519",
												})
											}
											type="button"
										>
											Generate ED25519 SSH Key
										</Button>
									</div>
								)}
								{(form.watch("privateKey") || form.watch("publicKey")) && (
									<div className="flex flex-wrap items-center gap-4">
										{form.watch("privateKey") && (
											<Button
												type="button"
												variant="ghost"
												size="base"
												onClick={() =>
													downloadKey(form.watch("privateKey"), "private")
												}
												className="flex items-center gap-2 px-0 !text-kumo-brand hover:!bg-transparent hover:underline"
											>
												<DownloadIcon className="h-4 w-4" />
												Private Key
											</Button>
										)}
										{form.watch("publicKey") && (
											<Button
												type="button"
												variant="ghost"
												size="base"
												onClick={() =>
													downloadKey(form.watch("publicKey"), "public")
												}
												className="flex items-center gap-2 px-0 !text-kumo-brand hover:!bg-transparent hover:underline"
											>
												<DownloadIcon className="h-4 w-4" />
												Public Key
											</Button>
										)}
									</div>
								)}
							</div>
							<div className="flex justify-end border-t border-kumo-hairline pt-4">
								<Button variant="primary" loading={isPending} type="submit">
									{sshKeyId ? "Update" : "Create"}
								</Button>
							</div>
						</Dialog.Footer>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
