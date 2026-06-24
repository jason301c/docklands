"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	AuthAltAction,
	AuthHeading,
	AuthInput,
	AuthSubmit,
	authLinkClassName,
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

const loginSchema = z.object({
	email: z
		.string()
		.min(1, {
			message: "Email is required",
		})
		.max(255, {
			message: "Email must be at most 255 characters",
		})
		.email({
			message: "Email must be a valid email",
		}),
});

type Login = z.infer<typeof loginSchema>;

export default function Home({
	emailConfigured,
}: {
	emailConfigured: boolean;
}) {
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const form = useForm<Login>({
		defaultValues: {
			email: "",
		},
		resolver: zodResolver(loginSchema),
	});

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (values: Login) => {
		setIsLoading(true);
		const { error } = await authClient.requestPasswordReset({
			email: values.email,
			redirectTo: "/reset-password",
		});
		if (error) {
			setError(error.message || "An error occurred");
			setIsLoading(false);
		} else {
			// Better Auth intentionally returns success even when the address is
			// unknown (anti-enumeration) and swallows a failed `sendResetPassword`
			// (e.g. no SMTP configured), so we can't truthfully claim delivery.
			// Keep the copy neutral; if mail is unconfigured the owner can recover
			// via the `reset-password` CLI op.
			toast.success(
				"If an account exists for that email, a reset link is on its way.",
			);
		}
		setIsLoading(false);
	};
	return (
		<div>
			<AuthHeading
				title="Forgot password?"
				description={
					emailConfigured
						? "Enter your email and we'll send you a reset link."
						: "Password reset by email isn't available on this instance."
				}
			/>

			{error && (
				<AlertBlock type="error" className="mb-4">
					{error}
				</AlertBlock>
			)}
			{emailConfigured ? (
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="sr-only">Email</FormLabel>
									<FormControl>
										<AuthInput
											placeholder="Email"
											autoComplete="email"
											maxLength={255}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<AuthSubmit loading={isLoading}>Send reset link</AuthSubmit>
					</form>
				</Form>
			) : (
				<AlertBlock type="warning">
					No email provider is configured for this instance, so reset links
					can't be sent. Ask an administrator to add one under Settings →
					Notifications, or reset your password from the server with the{" "}
					<code className="font-mono">reset-password</code> CLI.
				</AlertBlock>
			)}

			<AuthAltAction>
				<Link className={authLinkClassName} href="/">
					Back to sign in
				</Link>
			</AuthAltAction>
		</div>
	);
}
