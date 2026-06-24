import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Table } from "@cloudflare/kumo/components/table";
import { format } from "date-fns";
import { MoreHorizontal, Users } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { AddUserPermissions } from "./add-permissions";
import { ChangeRole } from "./change-role";

const logger = createClientLogger("users");

export const ShowUsers = () => {
	const usersQuery = api.user.all.useQuery();
	const { refetch } = usersQuery;
	const { mutateAsync } = api.user.remove.useMutation();
	const { permissions } = usePermissions();

	const { data: session } = api.user.session.useQuery();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<Users className="size-6 text-kumo-subtle self-center" />
						Users
					</h3>
					<p>Add your users to your Docklands account.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					<QueryState
						query={usersQuery}
						isEmpty={(data) => data.length === 0}
						empty={
							<EmptyState
								icon={Users}
								title="Invite users to your Docklands account"
							/>
						}
					>
						{(data) => (
							<div className="flex flex-col gap-4  min-h-[25vh]">
								<Table>
									<Table.Header>
										<Table.Row>
											<Table.Head className="w-[100px]">Email</Table.Head>
											<Table.Head className="text-center">Role</Table.Head>
											<Table.Head className="text-center">2FA</Table.Head>

											<Table.Head className="text-center">
												Created At
											</Table.Head>
											<Table.Head className="text-right">Actions</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{data.map((member) => {
											const currentUserRole = data.find(
												(m) => m.user.id === session?.user?.id,
											)?.role;

											// Owner never has "Edit Permissions" (they're absolute owner)
											// Other users can edit permissions if target is not themselves and target is a member/custom role
											const isStaticAdminOrOwner =
												member.role === "owner" || member.role === "admin";
											const canEditPermissions =
												!isStaticAdminOrOwner &&
												member.user.id !== session?.user?.id;

											// Can change role based on hierarchy:
											// - Owner: Can change anyone's role (except themselves and other owners)
											// - Admin: Can only change member/custom roles (not other admins or owners)
											// - Owner role is nontransferable
											const canChangeRole =
												member.role !== "owner" &&
												member.user.id !== session?.user?.id &&
												(currentUserRole === "owner" ||
													(currentUserRole === "admin" &&
														member.role !== "admin"));

											const canDeleteMember =
												permissions?.member.delete ?? false;

											// Self-hosted: "Delete User" removes the user entirely
											// Cloud: "Unlink User" removes from the organization only
											const canRemove =
												member.role !== "owner" &&
												member.user.id !== session?.user?.id &&
												(currentUserRole === "owner" ||
													(currentUserRole === "admin" &&
														member.role !== "admin") ||
													(canDeleteMember && !isStaticAdminOrOwner));

											const canDelete = canRemove;

											const hasAnyAction =
												canEditPermissions || canChangeRole || canDelete;

											return (
												<Table.Row key={member.id}>
													<Table.Cell className="w-[100px]">
														{member.user.email}
														{member.user.id === session?.user?.id && (
															<span className="text-kumo-subtle ml-1">
																(You)
															</span>
														)}
													</Table.Cell>
													<Table.Cell className="text-center">
														<Badge
															variant={
																member.role === "owner"
																	? "secondary"
																	: "secondary"
															}
														>
															{member.role}
														</Badge>
													</Table.Cell>
													<Table.Cell className="text-center">
														{member.user.twoFactorEnabled
															? "Enabled"
															: "Disabled"}
													</Table.Cell>
													<Table.Cell className="text-center">
														<span className="text-sm text-kumo-subtle">
															{format(new Date(member.createdAt), "PPpp")}
														</span>
													</Table.Cell>

													<Table.Cell className="text-right flex justify-end">
														{hasAnyAction ? (
															<DropdownMenu>
																<DropdownMenu.Trigger
																	render={
																		<Button
																			variant="ghost"
																			className="h-8 w-8 p-0"
																		>
																			<span className="sr-only">Open menu</span>
																			<MoreHorizontal className="h-4 w-4" />
																		</Button>
																	}
																/>
																<DropdownMenu.Content align="end">
																	<DropdownMenu.Group>
																		<DropdownMenu.Label>
																			Actions
																		</DropdownMenu.Label>
																	</DropdownMenu.Group>

																	{canChangeRole && (
																		<ChangeRole
																			memberId={member.id}
																			currentRole={member.role}
																			userEmail={member.user.email}
																		/>
																	)}

																	{canEditPermissions && (
																		<AddUserPermissions
																			userId={member.user.id}
																			role={member.role}
																		/>
																	)}

																	{canDelete && (
																		<DialogAction
																			title="Delete User"
																			description="This permanently deletes the user account and everything tied to it — sessions, API keys, 2FA, credentials, and all organization memberships. It cannot be undone. Continue?"
																			type="destructive"
																			onClick={async () => {
																				await mutateAsync({
																					userId: member.user.id,
																				})
																					.then(() => {
																						toast.success(
																							"User deleted successfully",
																						);
																						refetch();
																					})
																					.catch((err) => {
																						logger.error(err);
																						toast.error(
																							err?.message ||
																								"Error deleting user",
																						);
																					});
																			}}
																		>
																			<DropdownMenu.Item
																				className="w-full cursor-pointer text-kumo-danger hover:!text-kumo-danger"
																				onSelect={(e) => e.preventDefault()}
																			>
																				Delete User
																			</DropdownMenu.Item>
																		</DialogAction>
																	)}
																</DropdownMenu.Content>
															</DropdownMenu>
														) : (
															<Button
																variant="ghost"
																className="h-8 w-8 p-0"
																disabled
															>
																<span className="sr-only">
																	No actions available
																</span>
																<MoreHorizontal className="h-4 w-4 text-kumo-subtle" />
															</Button>
														)}
													</Table.Cell>
												</Table.Row>
											);
										})}
									</Table.Body>
								</Table>
							</div>
						)}
					</QueryState>
				</div>
			</div>
		</div>
	);
};
