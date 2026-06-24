"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	AuthAltAction,
	AuthHeading,
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

const loginSchema = z
	.object({
		password: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.min(8, {
				message: "Password must be at least 8 characters",
			}),
		confirmPassword: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.min(8, {
				message: "Password must be at least 8 characters",
			}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type Login = z.infer<typeof loginSchema>;

interface Props {
	tokenResetPassword: string;
}
export default function Home({ tokenResetPassword }: Props) {
	const [token, setToken] = useState<string | null>(tokenResetPassword);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const form = useForm<Login>({
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
		resolver: zodResolver(loginSchema),
	});

	useEffect(() => {
		const token = new URLSearchParams(window.location.search).get("token");

		if (token) {
			setToken(token);
		}
	}, [token]);

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (values: Login) => {
		setIsLoading(true);
		const { error } = await authClient.resetPassword({
			newPassword: values.password,
			token: token || "",
		});

		if (error) {
			setError(error.message || "An error occurred");
		} else {
			toast.success("Password reset successfully");
			router.push("/");
		}
		setIsLoading(false);
	};
	return (
		<div>
			<AuthHeading
				title="Reset password"
				description="Choose a new password for your account."
			/>

			{error && (
				<AlertBlock type="error" className="mb-4">
					{error}
				</AlertBlock>
			)}
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">New password</FormLabel>
								<FormControl>
									<PasswordInput
										placeholder="New password"
										autoComplete="new-password"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Confirm password</FormLabel>
								<FormControl>
									<PasswordInput
										placeholder="Confirm password"
										autoComplete="new-password"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<AuthSubmit loading={isLoading}>Reset password</AuthSubmit>
				</form>
			</Form>

			<AuthAltAction>
				Remembered it?{" "}
				<Link className={authLinkClassName} href="/">
					Sign in
				</Link>
			</AuthAltAction>
		</div>
	);
}
