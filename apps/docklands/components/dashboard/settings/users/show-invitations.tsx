import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import copy from "copy-to-clipboard";
import { format, isPast } from "date-fns";
import { MoreHorizontal, Users } from "lucide-react";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { DropdownMenu } from "@/components/shared/dropdown";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { AddInvitation } from "./add-invitation";

export const ShowInvitations = () => {
	const invitationsQuery = api.organization.allInvitations.useQuery();
	const { refetch } = invitationsQuery;

	const { mutateAsync: removeInvitation } =
		api.organization.removeInvitation.useMutation();

	return (
		<SectionCard title="Invitations">
			<QueryState
				query={invitationsQuery}
				isEmpty={(data) => data.length === 0}
				empty={
					<EmptyState
						icon={Users}
						title="Invite users to your organization"
						action={<AddInvitation />}
					/>
				}
			>
				{(data) => (
					<div className="flex flex-col gap-4  min-h-[25vh]">
						<Table>
							<caption>See all invitations</caption>
							<Table.Header>
								<Table.Row>
									<Table.Head className="w-[100px]">Email</Table.Head>
									<Table.Head className="text-center">Role</Table.Head>
									<Table.Head className="text-center">Status</Table.Head>
									<Table.Head className="text-center">Expires At</Table.Head>
									<Table.Head className="text-right">Actions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{data.map((invitation) => {
									const isExpired = isPast(new Date(invitation.expiresAt));
									return (
										<Table.Row key={invitation.id}>
											<Table.Cell className="w-[100px]">
												{invitation.email}
											</Table.Cell>
											<Table.Cell className="text-center">
												<Badge
													variant={
														invitation.role === "owner"
															? "secondary"
															: "secondary"
													}
												>
													{invitation.role}
												</Badge>
											</Table.Cell>
											<Table.Cell className="text-center">
												<Badge
													variant={
														invitation.status === "pending"
															? "secondary"
															: invitation.status === "canceled"
																? "destructive"
																: "secondary"
													}
												>
													{invitation.status}
												</Badge>
											</Table.Cell>
											<Table.Cell className="text-center">
												{format(new Date(invitation.expiresAt), "PPpp")}{" "}
												{isExpired ? (
													<span className="text-kumo-subtle">(Expired)</span>
												) : null}
											</Table.Cell>

											<Table.Cell className="text-right flex justify-end">
												<DropdownMenu>
													<DropdownMenu.Trigger
														render={
															<Button
																variant="ghost"
																className="h-8 w-8 p-0"
																aria-label={`Open actions for invitation to ${invitation.email}`}
															>
																<span className="sr-only">
																	Open actions for invitation to{" "}
																	{invitation.email}
																</span>
																<MoreHorizontal className="h-4 w-4" />
															</Button>
														}
													/>
													<DropdownMenu.Content align="end">
														<DropdownMenu.Group>
															<DropdownMenu.Label>Actions</DropdownMenu.Label>
														</DropdownMenu.Group>
														{!isExpired && (
															<>
																{invitation.status === "pending" && (
																	<DropdownMenu.Item
																		className="w-full cursor-pointer"
																		onSelect={() => {
																			copy(
																				`${origin}/invitation?token=${invitation.id}`,
																			);
																			toast.success(
																				"Invitation Copied to clipboard",
																			);
																		}}
																	>
																		Copy Invitation
																	</DropdownMenu.Item>
																)}

																{invitation.status === "pending" && (
																	<DropdownMenu.Item
																		className="w-full cursor-pointer"
																		onSelect={async () => {
																			const result =
																				await authClient.organization.cancelInvitation(
																					{
																						invitationId: invitation.id,
																					},
																				);

																			if (result.error) {
																				toast.error(result.error.message);
																			} else {
																				toast.success("Invitation deleted");
																				refetch();
																			}
																		}}
																	>
																		Cancel Invitation
																	</DropdownMenu.Item>
																)}
															</>
														)}
														<DropdownMenu.Item
															className="w-full cursor-pointer"
															onSelect={async () => {
																await removeInvitation({
																	invitationId: invitation.id,
																}).then(() => {
																	refetch();
																	toast.success("Invitation removed");
																});
															}}
														>
															Remove Invitation
														</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu>
											</Table.Cell>
										</Table.Row>
									);
								})}
							</Table.Body>
						</Table>

						<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
							<AddInvitation />
						</div>
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
};
