"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { ArrowRight, Fingerprint } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	AuthHeading,
	AuthInput,
	AuthSubmit,
	authLinkClassName,
	PasswordInput,
} from "@/components/shared/auth-screen";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("onboarding");

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	rememberMe: z.boolean(),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function Home() {
	const router = useRouter();
	const [isLoginLoading, setIsLoginLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const loginForm = useForm<LoginForm>({
		resolver: zodResolver(LoginSchema),
		defaultValues: {
			email: "",
			password: "",
			rememberMe: true,
		},
	});

	// Opt in to passkey autofill: when the browser has a discoverable credential
	// for this site it offers it inline on the email field. Best-effort — it
	// resolves with no data (or throws) if the browser has no passkey or the user
	// dismisses the autofill, which is fine.
	useEffect(() => {
		void (async () => {
			try {
				const result = await authClient.signIn.passkey({ autoFill: true });
				if (result && "data" in result && result.data) {
					router.push("/dashboard/workspace");
				}
			} catch {
				/* no discoverable passkey / user dismissed autofill */
			}
		})();
	}, [router]);

	const onSubmit = async (values: LoginForm) => {
		setIsLoginLoading(true);
		try {
			const { error } = await authClient.signIn.email({
				email: values.email,
				password: values.password,
				rememberMe: values.rememberMe,
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

			toast.success("Logged in successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("An error occurred while logging in", err);
			toast.error("An error occurred while logging in");
		} finally {
			setIsLoginLoading(false);
		}
	};

	const onPasskeySignIn = async () => {
		setError(null);
		setIsPasskeyLoading(true);
		try {
			const result = await authClient.signIn.passkey();

			if (result?.error) {
				// A user-cancelled WebAuthn prompt is an expected, non-error outcome.
				if (
					result.error.name === "NotAllowedError" ||
					result.error.code === "AUTH_CANCELLED"
				) {
					return;
				}
				toast.error(result.error.message || "Couldn't sign in with a passkey");
				setError(result.error.message || "Couldn't sign in with a passkey");
				return;
			}

			toast.success("Logged in successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("An error occurred during passkey sign-in", err);
			toast.error("An error occurred during passkey sign-in");
		} finally {
			setIsPasskeyLoading(false);
		}
	};

	return (
		<div>
			<AuthHeading
				title="Welcome back"
				description="Sign in to your Docklands instance."
			/>
			{error && (
				<AlertBlock type="error" className="mb-4">
					<span>{error}</span>
				</AlertBlock>
			)}
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
								<FormLabel className="sr-only">Email</FormLabel>
								<FormControl>
									<AuthInput
										placeholder="Email"
										autoComplete="email webauthn"
										{...field}
									/>
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
								<FormLabel className="sr-only">Password</FormLabel>
								<FormControl>
									<PasswordInput
										placeholder="Password"
										autoComplete="current-password webauthn"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className="flex items-center justify-between">
						<FormField
							control={loginForm.control}
							name="rememberMe"
							render={({ field }) => (
								<Checkbox
									label="Remember me"
									controlFirst
									checked={!!field.value}
									onCheckedChange={(checked) =>
										field.onChange(checked === true)
									}
								/>
							)}
						/>
						<Link href="/send-reset-password" className={authLinkClassName}>
							Forgot password?
						</Link>
					</div>
					<AuthSubmit loading={isLoginLoading}>
						Sign in
						<ArrowRight className="size-4" />
					</AuthSubmit>
				</form>
			</Form>

			<div className="my-6 flex items-center gap-4">
				<span className="h-px flex-1 bg-kumo-hairline" />
				<span className="text-xs text-kumo-subtle uppercase tracking-wide">
					or
				</span>
				<span className="h-px flex-1 bg-kumo-hairline" />
			</div>

			<Button
				type="button"
				variant="outline"
				size="lg"
				className="h-11 w-full justify-center rounded-xl"
				loading={isPasskeyLoading}
				onClick={onPasskeySignIn}
			>
				<Fingerprint className="size-4" />
				Sign in with a passkey
			</Button>
		</div>
	);
}
