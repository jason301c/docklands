import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import copy from "copy-to-clipboard";
import {
	CopyIcon,
	DownloadIcon,
	KeyRound,
	RefreshCw,
	ShieldOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
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
import {
	BACKUP_CODES_PLACEHOLDER,
	backupCodeTemplate,
	DATE_PLACEHOLDER,
	USERNAME_PLACEHOLDER,
} from "./enable-2fa";

const PasswordSchema = z.object({
	password: z.string().min(8, {
		message: "Password is required",
	}),
});

type PasswordForm = z.infer<typeof PasswordSchema>;
type Step = "password" | "actions" | "backup-codes";

export const Configure2FA = () => {
	const utils = api.useUtils();
	const { data: currentUser } = api.user.get.useQuery();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [step, setStep] = useState<Step>("password");
	const [password, setPassword] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [showDisableConfirm, setShowDisableConfirm] = useState(false);
	const [isDisabling, setIsDisabling] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);

	const form = useForm<PasswordForm>({
		resolver: zodResolver(PasswordSchema),
		defaultValues: {
			password: "",
		},
	});

	useEffect(() => {
		if (!isDialogOpen) {
			setStep("password");
			setPassword("");
			setBackupCodes([]);
			form.reset();
		}
	}, [isDialogOpen, form]);

	const handlePasswordSubmit = async (formData: PasswordForm) => {
		setIsRegenerating(true);
		try {
			// Verify password by attempting to generate backup codes
			// This validates the password and checks if 2FA is enabled
			const result = await authClient.twoFactor.generateBackupCodes({
				password: formData.password,
			});

			if (result.error) {
				form.setError("password", { message: result.error.message });
				toast.error(result.error.message);
				return;
			}

			// If we get here, password is correct
			setPassword(formData.password);
			setStep("actions");
		} catch (error) {
			form.setError("password", {
				message: error instanceof Error ? error.message : "Incorrect password",
			});
			toast.error("Incorrect password");
		} finally {
			setIsRegenerating(false);
		}
	};

	const handleRegenerateBackupCodes = async () => {
		setIsRegenerating(true);
		try {
			const result = await authClient.twoFactor.generateBackupCodes({
				password,
			});

			if (result.error) {
				toast.error(result.error.message);
				return;
			}

			if (result.data?.backupCodes) {
				setBackupCodes(result.data.backupCodes);
				setStep("backup-codes");
				toast.success("Backup codes regenerated successfully");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to regenerate backup codes",
			);
		} finally {
			setIsRegenerating(false);
		}
	};

	const handleDisable2FA = async () => {
		setIsDisabling(true);
		try {
			const result = await authClient.twoFactor.disable({
				password,
			});

			if (result.error) {
				toast.error(result.error.message);
				return;
			}

			toast.success("2FA disabled successfully");
			utils.user.get.invalidate();
			setIsDialogOpen(false);
			setShowDisableConfirm(false);
		} catch (error) {
			toast.error("Failed to disable 2FA. Please try again.");
		} finally {
			setIsDisabling(false);
		}
	};

	const handleCloseDialog = () => {
		if (step === "backup-codes") {
			setStep("actions");
		} else {
			setIsDialogOpen(false);
		}
	};

	const handleDownloadBackupCodes = () => {
		if (!backupCodes || backupCodes.length === 0) {
			toast.error("No backup codes to download.");
			return;
		}

		const backupCodesFormatted = backupCodes
			.map((code, index) => ` ${index + 1}. ${code}`)
			.join("\n");

		const date = new Date();
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const filename = `docklands-2fa-backup-codes-${year}${month}${day}.txt`;

		const backupCodesText = backupCodeTemplate
			.replace(USERNAME_PLACEHOLDER, currentUser?.user?.email || "unknown")
			.replace(DATE_PLACEHOLDER, date.toLocaleString())
			.replace(BACKUP_CODES_PLACEHOLDER, backupCodesFormatted);

		const blob = new Blob([backupCodesText], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleCopyBackupCodes = () => {
		const date = new Date();

		const backupCodesFormatted = backupCodes
			.map((code, index) => ` ${index + 1}. ${code}`)
			.join("\n");

		const backupCodesText = backupCodeTemplate
			.replace(USERNAME_PLACEHOLDER, currentUser?.user?.email || "unknown")
			.replace(DATE_PLACEHOLDER, date.toLocaleString())
			.replace(BACKUP_CODES_PLACEHOLDER, backupCodesFormatted);

		copy(backupCodesText);
		toast.success("Backup codes copied to clipboard");
	};

	return (
		<>
			<Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<Dialog.Trigger
					render={
						<Button variant="secondary">
							<KeyRound className="size-4 text-kumo-subtle" />
							Manage 2FA
						</Button>
					}
				/>
				<Dialog className="sm:max-w-xl">
					<Dialog.Header>
						<Dialog.Title>
							{step === "password" && "Verify Your Identity"}
							{step === "actions" && "2FA Configuration"}
							{step === "backup-codes" && "New Backup Codes"}
						</Dialog.Title>
						<Dialog.Description>
							{step === "password" &&
								"Enter your password to manage your 2FA settings"}
							{step === "actions" &&
								"Choose an action to manage your two-factor authentication"}
							{step === "backup-codes" &&
								"Save these backup codes in a secure place"}
						</Dialog.Description>
					</Dialog.Header>

					{step === "password" && (
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(handlePasswordSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Password</FormLabel>
											<FormControl>
												<Input
													type="password"
													placeholder="Enter your password"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												Enter your password to continue
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
								<Dialog.Footer>
									<Button
										type="button"
										variant="outline"
										onClick={() => setIsDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button type="submit" loading={isRegenerating}>
										Continue
									</Button>
								</Dialog.Footer>
							</form>
						</Form>
					)}

					{step === "actions" && (
						<div className="space-y-4">
							<div className="grid gap-3">
								<div className="flex flex-col gap-2 p-4 border rounded-lg hover:bg-kumo-fill/50 transition-colors">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<h4 className="font-medium flex items-center gap-2">
												<RefreshCw className="size-4" />
												Regenerate Backup Codes
											</h4>
											<p className="text-sm text-kumo-subtle mt-1">
												Generate new backup codes to replace your existing ones.
												This will invalidate all previous backup codes.
											</p>
										</div>
									</div>
									<Button
										onClick={handleRegenerateBackupCodes}
										variant="outline"
										className="w-full mt-2"
										loading={isRegenerating}
									>
										<RefreshCw className="size-4 mr-2" />
										Regenerate Backup Codes
									</Button>
								</div>

								<div className="flex flex-col gap-2 p-4 border border-kumo-danger/50 rounded-lg hover:bg-kumo-danger/5 transition-colors">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<h4 className="font-medium flex items-center gap-2 text-kumo-danger">
												<ShieldOff className="size-4" />
												Disable 2FA
											</h4>
											<p className="text-sm text-kumo-subtle mt-1">
												Completely disable two-factor authentication for your
												account. This will make your account less secure.
											</p>
										</div>
									</div>
									<Button
										onClick={() => setShowDisableConfirm(true)}
										variant="destructive"
										className="w-full mt-2"
									>
										<ShieldOff className="size-4 mr-2" />
										Disable 2FA
									</Button>
								</div>
							</div>

							<Dialog.Footer>
								<Button
									variant="outline"
									onClick={() => setIsDialogOpen(false)}
								>
									Close
								</Button>
							</Dialog.Footer>
						</div>
					)}

					{step === "backup-codes" && (
						<div className="space-y-4">
							<div className="w-full space-y-3 border rounded-lg p-4 bg-kumo-fill/50">
								<div className="grid grid-cols-2 gap-2">
									{backupCodes.map((code, index) => (
										<code
											key={`${code}-${index}`}
											className="bg-kumo-canvas p-2 rounded text-sm font-mono text-center"
										>
											{code}
										</code>
									))}
								</div>
								<p className="text-sm text-kumo-subtle">
									Save these backup codes in a secure place. You can use them to
									access your account if you lose access to your authenticator
									device. Each code can only be used once.
								</p>
							</div>

							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleDownloadBackupCodes}
									className="flex-1"
								>
									<DownloadIcon className="size-4 mr-2" />
									Download
								</Button>
								<Button
									variant="outline"
									onClick={handleCopyBackupCodes}
									className="flex-1"
								>
									<CopyIcon className="size-4 mr-2" />
									Copy
								</Button>
							</div>

							<Dialog.Footer>
								<Button variant="outline" onClick={handleCloseDialog}>
									Back to Actions
								</Button>
								<Button onClick={() => setIsDialogOpen(false)}>Done</Button>
							</Dialog.Footer>
						</div>
					)}
				</Dialog>
			</Dialog.Root>

			<Dialog.Root
				role="alertdialog"
				open={showDisableConfirm}
				onOpenChange={setShowDisableConfirm}
			>
				<Dialog>
					<Dialog.Header>
						<Dialog.Title>Are you absolutely sure?</Dialog.Title>
						<Dialog.Description>
							This will permanently disable Two-Factor Authentication for your
							account. Your account will be less secure without 2FA enabled.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Dialog.Close>Cancel</Dialog.Close>
						<Dialog.Close
							onClick={handleDisable2FA}
							className="bg-kumo-danger text-kumo-inverse hover:bg-kumo-danger/90"
							disabled={isDisabling}
						>
							{isDisabling ? "Disabling..." : "Disable 2FA"}
						</Dialog.Close>
					</Dialog.Footer>
				</Dialog>
			</Dialog.Root>
		</>
	);
};
