import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Table } from "@cloudflare/kumo/components/table";
import copy from "copy-to-clipboard";
import { format, isPast } from "date-fns";
import { Loader2, Mail, MoreHorizontal, Users } from "lucide-react";
import { api } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { toast } from "@/components/shared/toast";
import { AddInvitation } from "./add-invitation";

export const ShowInvitations = () => {
	const { data, isPending, refetch } =
		api.organization.allInvitations.useQuery();

	const { mutateAsync: removeInvitation } =
		api.organization.removeInvitation.useMutation();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-background p-6">
				<div className="">
					<h3 className="text-xl flex flex-row gap-2">
						<Mail className="size-6 text-muted-foreground self-center" />
						Invitations
					</h3>
					<p>Create invitations to your organization.</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{data?.length === 0 ? (
								<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
									<Users className="size-8 self-center text-muted-foreground" />
									<span className="text-base text-muted-foreground">
										Invite users to your organization
									</span>
									<AddInvitation />
								</div>
							) : (
								<div className="flex flex-col gap-4  min-h-[25vh]">
									<Table>
										<caption>See all invitations</caption>
										<Table.Header>
											<Table.Row>
												<Table.Head className="w-[100px]">Email</Table.Head>
												<Table.Head className="text-center">Role</Table.Head>
												<Table.Head className="text-center">Status</Table.Head>
												<Table.Head className="text-center">
													Expires At
												</Table.Head>
												<Table.Head className="text-right">Actions</Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{data?.map((invitation) => {
												const isExpired = isPast(
													new Date(invitation.expiresAt),
												);
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
																<span className="text-muted-foreground">
																	(Expired)
																</span>
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
																	<DropdownMenu.Label>
																		Actions
																	</DropdownMenu.Label>
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
																							toast.success(
																								"Invitation deleted",
																							);
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
						</>
					)}
				</div>
			</div>
		</div>
	);
};
