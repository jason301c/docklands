import { Button } from "@cloudflare/kumo/components/button";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Input } from "@cloudflare/kumo/components/input";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
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
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";

const addInvitation = z
	.object({
		mode: z.enum(["invitation", "credentials"]),
		email: z
			.string()
			.min(1, "Email is required")
			.email({ message: "Invalid email" }),
		role: z.string().min(1, "Role is required"),
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
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const utils = api.useUtils();
	const { data: emailConfigured } =
		api.notification.isSystemEmailConfigured.useQuery();
	const { mutateAsync: inviteMember } =
		api.organization.inviteMember.useMutation();
	const { mutateAsync: sendInvitation } = api.user.sendInvitation.useMutation();
	const { mutateAsync: createUserWithCredentials } =
		api.user.createUserWithCredentials.useMutation();
	const { data: customRoles } = api.customRole.all.useQuery();
	const [error, setError] = useState<string | null>(null);

	const form = useForm<AddInvitation>({
		defaultValues: {
			mode: "invitation",
			email: "",
			role: "member",
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
				return;
			}

			const result = await inviteMember({
				email: data.email.toLowerCase(),
				role: data.role,
			});
			const { inviteLink: link, emailed } = await sendInvitation({
				invitationId: result!.id,
			});

			if (emailed) {
				toast.success("Invitation created and emailed");
				setOpen(false);
			} else {
				// No email provider configured — surface the link to share manually
				// instead of pretending an email went out.
				setInviteLink(link);
				toast.success(
					"Invitation created — email isn't configured, share the link manually",
				);
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
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setInviteLink(null);
					setError(null);
				}
			}}
		>
			<Dialog.Trigger
				className=""
				render={
					<Button>
						<PlusIcon className="h-4 w-4" /> Add User
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<Dialog.Header>
					<Dialog.Title>Add User</Dialog.Title>
					<Dialog.Description>
						{mode === "credentials"
							? "Create a user with initial credentials"
							: "Invite a new user"}
					</Dialog.Description>
				</Dialog.Header>
				{error && <AlertBlock type="error">{error}</AlertBlock>}

				{inviteLink ? (
					<div className="flex flex-col gap-2">
						<AlertBlock type="success">
							Invitation created. This instance has no email provider, so share
							this link with the invitee manually — it expires with the
							invitation.
						</AlertBlock>
						<ClipboardText text={inviteLink} />
					</div>
				) : (
					mode === "invitation" &&
					emailConfigured === false && (
						<AlertBlock type="warning" className="mb-4">
							No email provider is configured, so the invitation can't be
							emailed — you'll get a link to share manually. Add one under
							Settings → Notifications to send invites automatically.
						</AlertBlock>
					)
				)}

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
										<FormControl>
											<Select
												aria-label="Invite method"
												onValueChange={field.onChange}
												value={field.value}
											>
												<Select.Option value="invitation">
													Invitation Link
												</Select.Option>
												<Select.Option value="credentials">
													Initial Credentials
												</Select.Option>
											</Select>
										</FormControl>
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
										<FormControl>
											<Select
												aria-label="Invitation role"
												onValueChange={field.onChange}
												value={field.value}
											>
												<Select.Option value="member">Member</Select.Option>
												<Select.Option value="admin">Admin</Select.Option>
												{customRoles?.map((role) => (
													<Select.Option key={role.role} value={role.role}>
														{role.role}
													</Select.Option>
												))}
											</Select>
										</FormControl>
										<FormDescription>
											Select the role for the new user
										</FormDescription>
										<FormMessage />
									</FormItem>
								);
							}}
						/>

						{mode === "credentials" && (
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => {
										return (
											<FormItem className="content-start">
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
											<FormItem className="content-start">
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
							</div>
						)}

						<Dialog.Footer className="w-full justify-start">
							<Button
								loading={form.formState.isSubmitting}
								form="hook-form-add-invitation"
								type="submit"
							>
								Create
							</Button>
						</Dialog.Footer>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
