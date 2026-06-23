"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
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
import { InputOTP } from "@/components/shared/input-otp";
import { Logo } from "@/components/shared/logo";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("onboarding");

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

const _TwoFactorSchema = z.object({
	code: z.string().min(6),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function Home() {
	const router = useRouter();
	const [isLoginLoading, setIsLoginLoading] = useState(false);
	const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false);
	const [isBackupCodeLoading, setIsBackupCodeLoading] = useState(false);
	const [isTwoFactor, setIsTwoFactor] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [isBackupCodeModalOpen, setIsBackupCodeModalOpen] = useState(false);
	const [backupCode, setBackupCode] = useState("");
	const loginForm = useForm<LoginForm>({
		resolver: zodResolver(LoginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (values: LoginForm) => {
		setIsLoginLoading(true);
		try {
			const { data, error } = await authClient.signIn.email({
				email: values.email,
				password: values.password,
			});

			if (error) {
				const isEmailNotVerified =
					error.code === "EMAIL_NOT_VERIFIED" ||
					error.message?.toLowerCase().includes("email not verified");
				if (isEmailNotVerified) {
					const msg =
						"Your email is not verified. We've sent a new verification link to your email.";
					toast.info(msg);
					setError(msg);
					return;
				}
				toast.error(error.message);
				setError(error.message || "An error occurred while logging in");
				return;
			}

			if (data?.twoFactorRedirect as boolean) {
				setTwoFactorCode("");
				setIsTwoFactor(true);
				toast.info("Please enter your 2FA code");
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("An error occurred while logging in", err);
			toast.error("An error occurred while logging in");
		} finally {
			setIsLoginLoading(false);
		}
	};
	const onTwoFactorSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (twoFactorCode.length !== 6) {
			toast.error("Please enter a valid 6-digit code");
			return;
		}

		setIsTwoFactorLoading(true);
		try {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: twoFactorCode.replace(/\s/g, ""),
			});

			if (error) {
				toast.error(error.message);
				setError(error.message || "An error occurred while verifying 2FA code");
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("An error occurred while verifying 2FA code", err);
			toast.error("An error occurred while verifying 2FA code");
		} finally {
			setIsTwoFactorLoading(false);
		}
	};

	const onBackupCodeSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (backupCode.length < 8) {
			toast.error("Please enter a valid backup code");
			return;
		}

		setIsBackupCodeLoading(true);
		try {
			const { error } = await authClient.twoFactor.verifyBackupCode({
				code: backupCode.trim(),
			});

			if (error) {
				toast.error(error.message);
				setError(
					error.message || "An error occurred while verifying backup code",
				);
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("An error occurred while verifying backup code", err);
			toast.error("An error occurred while verifying backup code");
		} finally {
			setIsBackupCodeLoading(false);
		}
	};

	const loginContent = (
		<>
			<Form {...loginForm}>
				<form
					onSubmit={loginForm.handleSubmit(onSubmit)}
					className="space-y-4"
					id="login-form"
				>
					<FormField
						control={loginForm.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input placeholder="john@example.com" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={loginForm.control}
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
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button
						className="w-full justify-center"
						type="submit"
						loading={isLoginLoading}
					>
						Login
					</Button>
				</form>
			</Form>
		</>
	);

	return (
		<section className="w-full rounded-lg border bg-kumo-canvas p-8 shadow-sm">
			<div className="mb-8 flex flex-col items-center gap-4 text-center">
				<Logo className="size-12" />
				<h1 className="font-semibold text-2xl tracking-tight">Login</h1>
			</div>
			{error && (
				<AlertBlock type="error" className="my-2">
					<span>{error}</span>
				</AlertBlock>
			)}
			<div>
				{!isTwoFactor ? (
					loginContent
				) : (
					<>
						<form
							onSubmit={onTwoFactorSubmit}
							className="space-y-4"
							id="two-factor-form"
							autoComplete="on"
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="totp-code">2FA Code</Label>
								<InputOTP
									id="totp-code"
									name="totp"
									value={twoFactorCode}
									onChange={setTwoFactorCode}
									maxLength={6}
									placeholder="••••••"
									pattern={REGEXP_ONLY_DIGITS}
									autoFocus
								/>
								<p>Enter the 6-digit code from your authenticator app</p>
								<button
									type="button"
									onClick={() => setIsBackupCodeModalOpen(true)}
									className="text-sm text-kumo-subtle hover:underline self-start mt-2"
								>
									Lost access to your authenticator app?
								</button>
							</div>

							<div className="flex gap-4">
								<Button
									variant="outline"
									className="w-full justify-center"
									type="button"
									onClick={() => {
										setIsTwoFactor(false);
										setTwoFactorCode("");
									}}
								>
									Back
								</Button>
								<Button
									className="w-full justify-center"
									type="submit"
									loading={isTwoFactorLoading}
								>
									Verify
								</Button>
							</div>
						</form>

						<Dialog.Root
							open={isBackupCodeModalOpen}
							onOpenChange={setIsBackupCodeModalOpen}
						>
							<Dialog>
								<div>
									<Dialog.Title>Enter Backup Code</Dialog.Title>
									<Dialog.Description>
										Enter one of your backup codes to access your account
									</Dialog.Description>
								</div>

								<form onSubmit={onBackupCodeSubmit} className="space-y-4">
									<div className="flex flex-col gap-2">
										<Label>Backup Code</Label>
										<Input
											aria-label="Backup code"
											value={backupCode}
											onChange={(e) => setBackupCode(e.target.value)}
											placeholder="Enter your backup code"
											className="font-mono"
										/>
										<p>
											Enter one of the backup codes you received when setting up
											2FA
										</p>
									</div>

									<div className="flex gap-4">
										<Button
											variant="outline"
											className="w-full justify-center"
											type="button"
											onClick={() => {
												setIsBackupCodeModalOpen(false);
												setBackupCode("");
											}}
										>
											Cancel
										</Button>
										<Button
											className="w-full justify-center"
											type="submit"
											loading={isBackupCodeLoading}
										>
											Verify
										</Button>
									</div>
								</form>
							</Dialog>
						</Dialog.Root>
					</>
				)}

				<div className="mt-5 flex flex-col items-center justify-center gap-2 text-center text-sm">
					<div>
						<Link
							className="hover:underline text-kumo-subtle"
							href="https://github.com/jason301c/docklands"
							target="_blank"
						>
							Lost your password?
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
