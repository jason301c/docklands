import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBox } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Input } from "@cloudflare/kumo/components/input";

const DATABASE_PASSWORD_REGEX = /^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~`]*$/;

const updatePasswordSchema = z
	.object({
		password: z
			.string()
			.min(1, "Password is required")
			.regex(DATABASE_PASSWORD_REGEX, {
				message:
					"Password contains invalid characters. Please avoid: $ ! ' \" \\ / and space characters",
			}),
		confirmPassword: z.string().min(1, "Please confirm the password"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type UpdatePassword = z.infer<typeof updatePasswordSchema>;

interface Props {
	label?: string;
	onUpdatePassword: (newPassword: string) => Promise<void>;
}

export const UpdateDatabasePassword = ({
	label = "Password",
	onUpdatePassword,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	const form = useForm<UpdatePassword>({
		defaultValues: { password: "", confirmPassword: "" },
		resolver: zodResolver(updatePasswordSchema),
	});

	const onSubmit = async (formData: UpdatePassword) => {
		setIsPending(true);
		setError(null);
		try {
			await onUpdatePassword(formData.password);
			form.reset();
			setIsOpen(false);
		} catch (e) {
			const raw = e instanceof Error ? e.message : "Error updating password";
			if (/No running container found/i.test(raw)) {
				setError(
					"The database container is not running. Please start the service before changing the password.",
				);
			} else {
				setError(raw);
			}
		} finally {
			setIsPending(false);
		}
	};
	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) {
					form.reset();
					setError(null);
				}
			}}
		>
			<Dialog.Trigger render={(

				<Button aria-label="Action" variant="ghost" shape="square">
					<PenBox className="size-3.5 text-muted-foreground" />
				</Button>
			
)} />
			<Dialog className="sm:max-w-lg">
				<div>
					<Dialog.Title>Update {label}</Dialog.Title>
					<Dialog.Description>
						Enter the new {label.toLowerCase()} for the database
					</Dialog.Description>
				</div>
				{error && <AlertBlock type="error">{error}</AlertBlock>}
				<AlertBlock type="warning" className="my-4">
					This will change the {label.toLowerCase()} both in the running
					database container and in Docklands. The container must be running for
					this operation to succeed.
				</AlertBlock>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>New {label}</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder={`Enter new ${label.toLowerCase()}`}
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
									<FormLabel>Confirm {label}</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder={`Confirm new ${label.toLowerCase()}`}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div>
							<Button loading={isPending} type="submit">
								Update
							</Button>
						</div>
					</form>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
