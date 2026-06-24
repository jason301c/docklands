import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Fingerprint, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { createClientLogger } from "@/client/lib/logger";
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
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from "@/components/shared/states";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("passkeys");

const NameSchema = z.object({
	name: z.string().trim().min(1, "Give this passkey a name").max(64),
});

type NameForm = z.infer<typeof NameSchema>;

type Passkey = {
	id: string;
	name?: string | null;
	createdAt?: Date | string | null;
};

const formatCreatedAt = (value: Passkey["createdAt"]) => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

/**
 * Passkey management for the profile Security card: register a new WebAuthn
 * credential, list the user's existing passkeys, and remove them. Listing is
 * driven by Better Auth's reactive `useListPasskeys` hook so the table updates
 * itself after add/delete without manual invalidation.
 */
export const Passkeys = () => {
	const { data, isPending, error, refetch } = authClient.useListPasskeys();
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [isAdding, setIsAdding] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Passkey | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const form = useForm<NameForm>({
		resolver: zodResolver(NameSchema),
		defaultValues: { name: "" },
	});

	const passkeys = (data ?? []) as Passkey[];

	const handleAdd = async (values: NameForm) => {
		setIsAdding(true);
		try {
			// `addPasskey` drives the browser WebAuthn ceremony and persists the
			// credential on success. It resolves to `undefined` on success and to
			// `{ error }` on failure, so a returned object means it failed.
			const result = await authClient.passkey.addPasskey({
				name: values.name.trim(),
			});

			if (result?.error) {
				// A user-cancelled WebAuthn prompt is an expected, non-error outcome.
				if (
					result.error.name === "NotAllowedError" ||
					result.error.code === "REGISTRATION_CANCELLED"
				) {
					toast.info("Passkey setup was cancelled");
					return;
				}
				throw new Error(result.error.message || "Failed to add passkey");
			}

			toast.success("Passkey added");
			setIsAddOpen(false);
			form.reset({ name: "" });
		} catch (err) {
			logger.error("Failed to add passkey", err);
			const message =
				err instanceof Error ? err.message : "Failed to add passkey";
			form.setError("name", { message });
			toast.error(message);
		} finally {
			setIsAdding(false);
		}
	};

	const handleDelete = async () => {
		if (!pendingDelete) return;
		setIsDeleting(true);
		try {
			const result = await authClient.passkey.deletePasskey({
				id: pendingDelete.id,
			});
			if (result?.error) {
				throw new Error(result.error.message || "Failed to remove passkey");
			}
			toast.success("Passkey removed");
			setPendingDelete(null);
		} catch (err) {
			logger.error("Failed to remove passkey", err);
			toast.error(
				err instanceof Error ? err.message : "Failed to remove passkey",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="flex flex-col gap-3 rounded-lg border border-kumo-hairline bg-kumo-fill/20 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-kumo-base">
						<Fingerprint className="size-4 text-kumo-subtle" />
					</span>
					<div className="flex flex-col">
						<span className="text-sm font-medium">Passkeys</span>
						<span className="text-sm text-kumo-subtle">
							Sign in with Touch ID, Windows Hello, or a security key instead of
							a password.
						</span>
					</div>
				</div>
				<div className="shrink-0 sm:self-center">
					<Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
						<Dialog.Trigger
							render={
								<Button>
									<Plus className="size-4" />
									Add passkey
								</Button>
							}
						/>
						<Dialog className="sm:max-w-md">
							<Dialog.Header>
								<Dialog.Title>Add a passkey</Dialog.Title>
								<Dialog.Description>
									Name this passkey so you can recognize it later, then follow
									your browser's prompt.
								</Dialog.Description>
							</Dialog.Header>
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(handleAdd)}
									className="space-y-4"
								>
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Passkey name</FormLabel>
												<FormControl>
													<Input
														placeholder="MacBook Touch ID"
														autoFocus
														{...field}
													/>
												</FormControl>
												<FormDescription>
													For example, the device or security key you're
													registering.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
									<Dialog.Footer>
										<Button
											type="button"
											variant="outline"
											onClick={() => setIsAddOpen(false)}
										>
											Cancel
										</Button>
										<Button type="submit" loading={isAdding}>
											Continue
										</Button>
									</Dialog.Footer>
								</form>
							</Form>
						</Dialog>
					</Dialog.Root>
				</div>
			</div>

			<div className="border-kumo-hairline border-t pt-3">
				{isPending ? (
					<LoadingState />
				) : error ? (
					<ErrorState
						title="Couldn't load your passkeys"
						onRetry={() => refetch()}
					/>
				) : passkeys.length === 0 ? (
					<EmptyState
						icon={KeyRound}
						title="No passkeys yet"
						description="Add a passkey to sign in without a password."
					/>
				) : (
					<ul className="flex flex-col gap-2">
						{passkeys.map((passkey) => {
							const created = formatCreatedAt(passkey.createdAt);
							return (
								<li
									key={passkey.id}
									className="flex items-center justify-between gap-3 rounded-md border bg-kumo-base px-3 py-2"
								>
									<div className="flex min-w-0 items-center gap-3">
										<KeyRound className="size-4 shrink-0 text-kumo-subtle" />
										<div className="flex min-w-0 flex-col">
											<span className="truncate text-sm font-medium">
												{passkey.name || "Passkey"}
											</span>
											{created && (
												<span className="text-xs text-kumo-subtle">
													Added {created}
												</span>
											)}
										</div>
									</div>
									<Button
										variant="ghost"
										shape="square"
										aria-label={`Remove ${passkey.name || "passkey"}`}
										onClick={() => setPendingDelete(passkey)}
									>
										<Trash2 className="size-4 text-kumo-danger" />
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<Dialog.Root
				role="alertdialog"
				open={pendingDelete !== null}
				onOpenChange={(open) => !open && setPendingDelete(null)}
			>
				<Dialog>
					<Dialog.Header>
						<Dialog.Title>Remove this passkey?</Dialog.Title>
						<Dialog.Description>
							{pendingDelete?.name ? (
								<>
									<span className="font-medium">{pendingDelete.name}</span> will
									no longer be able to sign in to your account.
								</>
							) : (
								"This passkey will no longer be able to sign in to your account."
							)}
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Dialog.Close>Cancel</Dialog.Close>
						<Dialog.Close
							onClick={handleDelete}
							className="bg-kumo-danger text-kumo-inverse hover:bg-kumo-danger/90"
							disabled={isDeleting}
						>
							Remove passkey
						</Dialog.Close>
					</Dialog.Footer>
				</Dialog>
			</Dialog.Root>
		</div>
	);
};
