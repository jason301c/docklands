import { Button } from "@cloudflare/kumo/components/button";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import { DropdownMenu } from "@/components/shared/dropdown";
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

const logger = createClientLogger("users");

const changeRoleSchema = z.object({
	role: z.string().min(1),
});

type ChangeRoleSchema = z.infer<typeof changeRoleSchema>;

interface Props {
	memberId: string;
	currentRole: string;
	userEmail: string;
}

export const ChangeRole = ({ memberId, currentRole, userEmail }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();

	const { data: customRoles } = api.customRole.all.useQuery(undefined, {
		enabled: isOpen,
	});

	const { mutateAsync, isError, error, isPending } =
		api.organization.updateMemberRole.useMutation();

	const form = useForm<ChangeRoleSchema>({
		defaultValues: {
			role: currentRole,
		},
		resolver: zodResolver(changeRoleSchema),
	});

	useEffect(() => {
		if (isOpen) {
			form.reset({
				role: currentRole,
			});
		}
	}, [form, currentRole, isOpen]);

	const onSubmit = async (data: ChangeRoleSchema) => {
		await mutateAsync({
			memberId,
			role: data.role,
		})
			.then(async () => {
				toast.success("Role updated successfully");
				await utils.user.all.invalidate();
				setIsOpen(false);
			})
			.catch((error) => {
				logger.error(error);
				toast.error(error?.message || "Error updating role");
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				nativeButton={false}
				className=""
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={(e) => e.preventDefault()}
					>
						Change Role
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="max-h-[85vh] sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>Change User Role</Dialog.Title>
					<Dialog.Description>
						Change the role for <strong>{userEmail}</strong>
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-change-role"
						onSubmit={form.handleSubmit(onSubmit)}
						className="w-full space-y-4"
					>
						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Role</FormLabel>
									<FormControl>
										<Select
											aria-label="User role"
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<Select.Option value="admin">Admin</Select.Option>
											<Select.Option value="member">Member</Select.Option>
											{customRoles?.map((customRole) => (
												<Select.Option
													key={customRole.role}
													value={customRole.role}
												>
													{customRole.role}
												</Select.Option>
											))}
										</Select>
									</FormControl>
									<FormDescription>
										<strong>Admin:</strong> Can manage users and settings.
										<br />
										<strong>Member:</strong> Limited permissions, can be
										customized.
										{customRoles && customRoles.length > 0 && (
											<>
												<br />
												<strong>Custom roles:</strong> Organization-defined
												permissions.
											</>
										)}
										<br />
										<em className="text-kumo-subtle text-xs">
											Note: Owner role is nontransferable.
										</em>
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<Dialog.Footer>
					<Button
						loading={isPending}
						form="hook-form-change-role"
						type="submit"
					>
						Update Role
					</Button>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
