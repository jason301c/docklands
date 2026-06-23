import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
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

const logger = createClientLogger("users");

const addInvitation = z
	.object({
		mode: z.enum(["invitation", "credentials"]),
		email: z
			.string()
			.min(1, "Email is required")
			.email({ message: "Invalid email" }),
		role: z.string().min(1, "Role is required"),
		notificationId: z.string().optional(),
		password: z.string().optional(),
		confirmPassword: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.mode !== "credentials") {
			return;
		}

		if (!value.password) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Password is required",
				path: ["password"],
			});
		} else if (value.password.length < 8) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Password must be at least 8 characters",
				path: ["password"],
			});
		}

		if (!value.confirmPassword) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Confirm password is required",
				path: ["confirmPassword"],
			});
		} else if (value.confirmPassword.length < 8) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Password must be at least 8 characters",
				path: ["confirmPassword"],
			});
		}

		if (
			value.password &&
			value.confirmPassword &&
			value.password !== value.confirmPassword
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Passwords do not match",
				path: ["confirmPassword"],
			});
		}
	});

type AddInvitation = z.infer<typeof addInvitation>;

export const AddInvitation = () => {
	const [open, setOpen] = useState(false);
	const utils = api.useUtils();
	const { data: emailProviders } =
		api.notification.getEmailProviders.useQuery();
	const { mutateAsync: inviteMember, isPending: isInviting } =
		api.organization.inviteMember.useMutation();
	const { mutateAsync: sendInvitation } = api.user.sendInvitation.useMutation();
	const { mutateAsync: createUserWithCredentials, isPending: isCreating } =
		api.user.createUserWithCredentials.useMutation();
	const { data: customRoles } = api.customRole.all.useQuery();
	const [error, setError] = useState<string | null>(null);

	const form = useForm<AddInvitation>({
		defaultValues: {
			mode: "invitation",
			email: "",
			role: "member",
			notificationId: "",
			password: "",
			confirmPassword: "",
		},
		resolver: zodResolver(addInvitation),
	});

	const mode = form.watch("mode");

	useEffect(() => {
		form.reset();
	}, [form, form.formState.isSubmitSuccessful, form.reset]);

	const onSubmit = async (data: AddInvitation) => {
		setError(null);

		try {
			if (data.mode === "credentials") {
				await createUserWithCredentials({
					email: data.email.toLowerCase(),
					password: data.password!,
					role: data.role,
				});
				toast.success("User created with initial credentials");
				setOpen(false);
			} else {
				const result = await inviteMember({
					email: data.email.toLowerCase(),
					role: data.role,
				});

				if (data.notificationId) {
					await sendInvitation({
						invitationId: result!.id,
						notificationId: data.notificationId || "",
					})
						.then(() => {
							toast.success("Invitation created and email sent");
						})
						.catch((error: unknown) => {
							logger.error(error);
							toast.error(
								error instanceof Error ? error.message : "An error occurred",
							);
						});
				} else {
					toast.success("Invitation created");
				}

				setOpen(false);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create user";
			setError(message);
			toast.error(message);
		} finally {
			await Promise.all([
				utils.organization.allInvitations.invalidate(),
				utils.user.all.invalidate(),
			]);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				className=""
				render={
					<Button>
						<PlusIcon className="h-4 w-4" /> Add Invitation
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>Add Invitation</Dialog.Title>
					<Dialog.Description>
						{mode === "credentials"
							? "Create a user with initial credentials"
							: "Invite a new user"}
					</Dialog.Description>
				</div>
				{error && <AlertBlock type="error">{error}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-add-invitation"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4 "
					>
						<FormField
							control={form.control}
							name="mode"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Invite Method</FormLabel>
										<Select
											aria-label="Invite method"
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<></>
											</FormControl>
											<>
												<Select.Option value="invitation">
													Invitation Link
												</Select.Option>
												<Select.Option value="credentials">
													Initial Credentials
												</Select.Option>
											</>
										</Select>
										<FormDescription>
											Choose between invitation link flow or direct credentials
											provisioning
										</FormDescription>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input placeholder={"email@docklands.local"} {...field} />
										</FormControl>
										<FormDescription>
											This will be the email of the new user
										</FormDescription>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						<FormField
							control={form.control}
							name="role"
							render={({ field }) => {
								return (
									<FormItem>
										<FormLabel>Role</FormLabel>
										<Select
											aria-label="Invitation role"
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<></>
											</FormControl>
											<>
												<Select.Option value="member">Member</Select.Option>
												<Select.Option value="admin">Admin</Select.Option>
												{customRoles?.map((role) => (
													<Select.Option key={role.role} value={role.role}>
														{role.role}
													</Select.Option>
												))}
											</>
										</Select>
										<FormDescription>
											Select the role for the new user
										</FormDescription>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						{mode === "invitation" && (
							<FormField
								control={form.control}
								name="notificationId"
								render={({ field }) => {
									return (
										<FormItem>
											<FormLabel>Email Provider</FormLabel>
											<Select
												aria-label="Invitation email provider"
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<></>
												</FormControl>
												<>
													{emailProviders?.map((provider) => (
														<Select.Option
															key={provider.notificationId}
															value={provider.notificationId}
														>
															{provider.name}
														</Select.Option>
													))}
													<Select.Option value="none" disabled>
														None
													</Select.Option>
												</>
											</Select>
											<FormDescription>
												Select the email provider to send the invitation
											</FormDescription>
											<FormMessage />
										</FormItem>
									);
								}}
							/>
						)}

						{mode === "credentials" && (
							<>
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Password</FormLabel>
												<FormControl>
													<Input
														type="password"
														placeholder="Enter initial password"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													The user can sign in with this password immediately
												</FormDescription>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								<FormField
									control={form.control}
									name="confirmPassword"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Confirm Password</FormLabel>
												<FormControl>
													<Input
														type="password"
														placeholder="Confirm initial password"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										);
									}}
								/>
							</>
						)}

						<div className="flex w-full flex-row">
							<Button
								loading={isInviting || isCreating}
								form="hook-form-add-invitation"
								type="submit"
							>
								Create
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
