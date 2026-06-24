"use client";

import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth/client";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	AuthHeading,
	AuthInput,
	AuthSubmit,
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

const registerSchema = z
	.object({
		name: z.string().min(1, {
			message: "First name is required",
		}),
		lastName: z.string().min(1, {
			message: "Last name is required",
		}),
		email: z
			.string()
			.min(1, {
				message: "Email is required",
			})
			.email({
				message: "Email must be a valid email",
			}),
		password: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine((password) => password === "" || password.length >= 8, {
				message: "Password must be at least 8 characters",
			}),
		confirmPassword: z
			.string()
			.min(1, {
				message: "Password is required",
			})
			.refine(
				(confirmPassword) =>
					confirmPassword === "" || confirmPassword.length >= 8,
				{
					message: "Password must be at least 8 characters",
				},
			),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type Register = z.infer<typeof registerSchema>;

interface Props {
	hasAdmin: boolean;
}

const Register = (_props: Props) => {
	const router = useRouter();
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<Register>({
		defaultValues: {
			name: "",
			lastName: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		resolver: zodResolver(registerSchema),
	});

	useEffect(() => {
		form.reset();
	}, [form, form.reset, form.formState.isSubmitSuccessful]);

	const onSubmit = async (values: Register) => {
		const { error } = await authClient.signUp.email({
			email: values.email,
			password: values.password,
			name: values.name,
			lastName: values.lastName,
		});

		if (error) {
			setIsError(true);
			setError(error.message || "An error occurred");
		} else {
			toast.success("User registered successfully", {
				duration: 2000,
			});
			router.push("/");
		}
	};
	return (
		<div>
			<AuthHeading
				title="Set up Docklands"
				description="Create the owner account for this instance."
			/>
			{isError && (
				<AlertBlock type="error" className="mb-4">
					<span>{error}</span>
				</AlertBlock>
			)}
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="sr-only">First name</FormLabel>
									<FormControl>
										<AuthInput
											placeholder="First name"
											autoComplete="given-name"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="lastName"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="sr-only">Last name</FormLabel>
									<FormControl>
										<AuthInput
											placeholder="Last name"
											autoComplete="family-name"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Email</FormLabel>
								<FormControl>
									<AuthInput
										placeholder="email@docklands.local"
										autoComplete="email"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="sr-only">Password</FormLabel>
								<FormControl>
									<PasswordInput
										placeholder="Password"
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
					<AuthSubmit loading={form.formState.isSubmitting}>
						Create account
						<ArrowRight className="size-4" />
					</AuthSubmit>
				</form>
			</Form>
		</div>
	);
};

export default Register;
