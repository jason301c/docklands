"use client";

import { LinkButton } from "@cloudflare/kumo/components/button";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	AuthHeading,
	AuthInput,
	AuthSubmit,
	authSubmitClassName,
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

const logger = createClientLogger("invitation");

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
	token: string;
	invitation: RouterOutputs["user"]["getUserByToken"];
	userAlreadyExists: boolean;
}

const Invitation = ({ token, invitation, userAlreadyExists }: Props) => {
	const router = useRouter();
	const { data } = api.user.getUserByToken.useQuery(
		{
			token,
		},
		{
			enabled: !!token,
			initialData: invitation,
		},
	);

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
		if (data?.email) {
			form.reset({
				email: data?.email || "",
				password: "",
				confirmPassword: "",
			});
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (values: Register) => {
		try {
			const { error } = await authClient.signUp.email({
				email: values.email,
				password: values.password,
				name: values.name,
				lastName: values.lastName,
				fetchOptions: {
					headers: {
						"x-docklands-token": token,
					},
				},
			});

			if (error) {
				toast.error(error.message);
				return;
			}

			const _result = await authClient.organization.acceptInvitation({
				invitationId: token,
			});

			toast.success("Account created successfully");
			router.push("/dashboard/workspace");
		} catch (err) {
			logger.error("invitation signup failed", err);
			toast.error("An error occurred while creating your account");
		}
	};

	return (
		<div>
			<AuthHeading
				title="Accept your invitation"
				description="Create your account to join this Docklands instance."
			/>
			{userAlreadyExists ? (
				<div className="flex flex-col gap-4">
					<AlertBlock type="success">
						<div className="flex flex-col gap-2">
							<span className="font-medium">Valid Invitation</span>
							<span className="text-kumo-success text-sm">
								We detected that you already have an account with this email.
								Please sign in to accept the invitation.
							</span>
						</div>
					</AlertBlock>

					<LinkButton
						href="/"
						variant="primary"
						size="lg"
						className={authSubmitClassName}
					>
						Sign in
					</LinkButton>
				</div>
			) : (
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
										<AuthInput disabled placeholder="Email" {...field} />
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
			)}
		</div>
	);
};
export default Invitation;
