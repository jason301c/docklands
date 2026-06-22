"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Logo } from "@/components/shared/logo";
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

type AuthResponse = {
	is2FAEnabled: boolean;
	authId: string;
};

export default function Home() {
	const [temp, _setTemp] = useState<AuthResponse>({
		is2FAEnabled: false,
		authId: "",
	});

	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const _router = useRouter();
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
			toast.success("Email sent", {
				duration: 2000,
			});
		}
		setIsLoading(false);
	};
	return (
		<section className="w-full rounded-lg border bg-kumo-canvas p-8 shadow-sm">
			<div className="mb-8 flex flex-col items-center gap-4 text-center">
				<Link href="/" aria-label="Docklands home">
					<Logo />
				</Link>
				<h1 className="font-semibold text-2xl tracking-tight">
					Reset Password
				</h1>
			</div>

			{error && (
				<AlertBlock type="error" className="my-2">
					{error}
				</AlertBlock>
			)}
			{!temp.is2FAEnabled ? (
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input placeholder="Email" maxLength={255} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							loading={isLoading}
							className="w-full justify-center"
						>
							Send Reset Link
						</Button>
					</form>
				</Form>
			) : null}

			<div className="mt-5 flex justify-center text-center text-sm">
				<Link className="hover:underline text-kumo-subtle" href="/">
					Login
				</Link>
			</div>
		</section>
	);
}
