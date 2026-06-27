import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Table } from "@cloudflare/kumo/components/table";
import copy from "copy-to-clipboard";
import { format, isPast } from "date-fns";
import { MoreHorizontal, Users } from "lucide-react";
import { useMemo } from "react";
import { api, type RouterOutputs } from "@/client/api/trpc";
import { authClient } from "@/client/auth/client";
import { usePermissions } from "@/client/hooks/use-permissions";
import { useUrl } from "@/client/hooks/use-url";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { DropdownMenu } from "@/components/shared/dropdown";
import { SectionCard } from "@/components/shared/section-card";
import {
	EmptyState,
	ErrorState,
	LoadingState,
} from "@/components/shared/states";
import { toast } from "@/components/shared/toast";
import { AddInvitation } from "./add-invitation";
import { AddUserPermissions } from "./add-permissions";
import { ChangeRole } from "./change-role";

const logger = createClientLogger("people");

type Member = RouterOutputs["user"]["all"][number];
type Invitation = RouterOutputs["organization"]["allInvitations"][number];

type PeopleRow =
	| {
			kind: "member";
			id: string;
			email: string;
			role: string;
			status: "active";
			date: Date;
			member: Member;
	  }
	| {
			kind: "invitation";
			id: string;
			email: string;
			role: string;
			status: string;
			date: Date;
			isExpired: boolean;
			invitation: Invitation;
	  };

const roleBadgeVariant = "secondary" as const;

const getInvitationStatus = (invitation: Invitation) => {
	const expired = isPast(new Date(invitation.expiresAt));
	if (expired && invitation.status === "pending") {
		return "expired";
	}

	return invitation.status;
};

const getStatusBadgeVariant = (status: string) => {
	if (status === "canceled" || status === "expired") {
		return "destructive" as const;
	}

	return "secondary" as const;
};

const buildRows = ({
	members,
	invitations,
}: {
	members: Member[];
	invitations: Invitation[];
}): PeopleRow[] => {
	const memberEmails = new Set(
		members.map((member) => member.user.email.toLowerCase()),
	);

	return [
		...members.map(
			(member): PeopleRow => ({
				kind: "member",
				id: member.id,
				email: member.user.email,
				role: member.role,
				status: "active",
				date: new Date(member.createdAt),
				member,
			}),
		),
		...invitations
			.filter((invitation) => !memberEmails.has(invitation.email.toLowerCase()))
			.map((invitation): PeopleRow => {
				const status = getInvitationStatus(invitation);
				return {
					kind: "invitation",
					id: invitation.id,
					email: invitation.email,
					role: invitation.role ?? "member",
					status,
					date: new Date(invitation.expiresAt),
					isExpired: status === "expired",
					invitation,
				};
			}),
	];
};

export const ShowPeople = ({
	canCreateMembers,
}: {
	canCreateMembers: boolean;
}) => {
	const usersQuery = api.user.all.useQuery();
	const invitationsQuery = api.organization.allInvitations.useQuery(undefined, {
		enabled: canCreateMembers,
	});
	const utils = api.useUtils();
	const { mutateAsync: removeUser } = api.user.remove.useMutation();
	const { mutateAsync: removeInvitation } =
		api.organization.removeInvitation.useMutation();
	const { permissions } = usePermissions();
	const { data: session } = api.user.session.useQuery();

	const members = usersQuery.data ?? [];
	const invitations = canCreateMembers ? (invitationsQuery.data ?? []) : [];
	const currentUserRole = members.find(
		(member) => member.user.id === session?.user?.id,
	)?.role;
	const rows = useMemo(
		() => buildRows({ members, invitations }),
		[members, invitations],
	);

	const retry = () => {
		usersQuery.refetch();
		if (canCreateMembers) {
			invitationsQuery.refetch();
		}
	};

	if (usersQuery.isError) {
		return (
			<SectionCard
				title="People"
				actions={canCreateMembers && <AddInvitation />}
			>
				<ErrorState
					error={usersQuery.error}
					title="Could not load people"
					onRetry={retry}
				/>
			</SectionCard>
		);
	}

	if (canCreateMembers && invitationsQuery.isError) {
		return (
			<SectionCard title="People" actions={<AddInvitation />}>
				<ErrorState
					error={invitationsQuery.error}
					title="Could not load invitations"
					onRetry={retry}
				/>
			</SectionCard>
		);
	}

	if (
		usersQuery.isPending ||
		usersQuery.data === undefined ||
		(canCreateMembers &&
			(invitationsQuery.isPending || invitationsQuery.data === undefined))
	) {
		return (
			<SectionCard
				title="People"
				actions={canCreateMembers && <AddInvitation />}
			>
				<LoadingState label="Loading people..." />
			</SectionCard>
		);
	}

	return (
		<SectionCard title="People" actions={canCreateMembers && <AddInvitation />}>
			{rows.length === 0 ? (
				<EmptyState
					icon={Users}
					title="Invite users to your organization"
					action={canCreateMembers ? <AddInvitation /> : undefined}
				/>
			) : (
				<div className="flex min-h-[25vh] flex-col gap-4">
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head className="min-w-[16rem]">Email</Table.Head>
								<Table.Head>Role</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head>Joined / Expires</Table.Head>
								<Table.Head>Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((row) => (
								<Table.Row key={`${row.kind}-${row.id}`}>
									<Table.Cell className="min-w-[16rem] break-all">
										{row.email}
										{row.kind === "member" &&
											row.member.user.id === session?.user?.id && (
												<span className="ml-1 text-kumo-subtle">(You)</span>
											)}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={roleBadgeVariant} className="capitalize">
											{row.role}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<Badge
											variant={getStatusBadgeVariant(row.status)}
											className="capitalize"
										>
											{row.status}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<span className="text-sm text-kumo-subtle">
											{format(row.date, "PPpp")}
										</span>
									</Table.Cell>
									<Table.Cell>
										{row.kind === "member" ? (
											<MemberActions
												member={row.member}
												currentUserId={session?.user?.id}
												currentUserRole={currentUserRole}
												canDeleteMember={permissions?.member.delete ?? false}
												onRemove={async () => {
													await removeUser({ userId: row.member.user.id });
													await utils.user.all.invalidate();
												}}
											/>
										) : (
											<InvitationActions
												invitation={row.invitation}
												isExpired={row.isExpired}
												onChanged={async () => {
													await utils.organization.allInvitations.invalidate();
												}}
												onRemove={async () => {
													await removeInvitation({
														invitationId: row.invitation.id,
													});
													await utils.organization.allInvitations.invalidate();
												}}
											/>
										)}
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</div>
			)}
		</SectionCard>
	);
};

const MemberActions = ({
	member,
	currentUserId,
	currentUserRole,
	canDeleteMember,
	onRemove,
}: {
	member: Member;
	currentUserId?: string;
	currentUserRole?: string;
	canDeleteMember: boolean;
	onRemove: () => Promise<void>;
}) => {
	const isStaticAdminOrOwner =
		member.role === "owner" || member.role === "admin";
	const canEditPermissions =
		!isStaticAdminOrOwner && member.user.id !== currentUserId;
	const canChangeRole =
		member.role !== "owner" &&
		member.user.id !== currentUserId &&
		(currentUserRole === "owner" ||
			(currentUserRole === "admin" && member.role !== "admin"));
	const canRemove =
		member.role !== "owner" &&
		member.user.id !== currentUserId &&
		(currentUserRole === "owner" ||
			(currentUserRole === "admin" && member.role !== "admin") ||
			(canDeleteMember && !isStaticAdminOrOwner));
	const hasAnyAction = canEditPermissions || canChangeRole || canRemove;

	if (!hasAnyAction) {
		return (
			<Button
				variant="ghost"
				className="inline-flex h-8 w-8 items-center justify-center p-0"
				disabled
			>
				<span className="sr-only">No actions available</span>
				<MoreHorizontal className="h-4 w-4 text-kumo-subtle" />
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						variant="ghost"
						className="inline-flex h-8 w-8 items-center justify-center p-0"
					>
						<span className="sr-only">
							Open actions for {member.user.email}
						</span>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				}
			/>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Group>
					<DropdownMenu.Label>Actions</DropdownMenu.Label>
				</DropdownMenu.Group>

				{canChangeRole && (
					<ChangeRole
						memberId={member.id}
						currentRole={member.role}
						userEmail={member.user.email}
					/>
				)}

				{canEditPermissions && (
					<AddUserPermissions userId={member.user.id} role={member.role} />
				)}

				{canRemove && (
					<DialogAction
						title="Delete User"
						description="This permanently deletes the user account and everything tied to it — sessions, API keys, passkeys, credentials, and all organization memberships. It cannot be undone. Continue?"
						type="destructive"
						onClick={async () => {
							try {
								await onRemove();
								toast.success("User deleted successfully");
							} catch (error) {
								logger.error(error);
								toast.error(
									error instanceof Error
										? error.message
										: "Error deleting user",
								);
							}
						}}
					>
						<DropdownMenu.Item
							className="w-full cursor-pointer text-kumo-danger hover:!text-kumo-danger"
							onSelect={(event) => event.preventDefault()}
						>
							Delete User
						</DropdownMenu.Item>
					</DialogAction>
				)}
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};

const InvitationActions = ({
	invitation,
	isExpired,
	onChanged,
	onRemove,
}: {
	invitation: Invitation;
	isExpired: boolean;
	onChanged: () => Promise<void>;
	onRemove: () => Promise<void>;
}) => {
	const instanceUrl = useUrl();
	const canUsePendingActions = !isExpired && invitation.status === "pending";

	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={
					<Button
						variant="ghost"
						className="inline-flex h-8 w-8 items-center justify-center p-0"
						aria-label={`Open actions for invitation to ${invitation.email}`}
					>
						<span className="sr-only">
							Open actions for invitation to {invitation.email}
						</span>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				}
			/>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Group>
					<DropdownMenu.Label>Actions</DropdownMenu.Label>
				</DropdownMenu.Group>

				<DropdownMenu.Item
					className="w-full cursor-pointer"
					onSelect={() => {
						copy(`${instanceUrl}/invitation?token=${invitation.id}`);
						toast.success("Invitation copied to clipboard");
					}}
				>
					Copy Invitation
				</DropdownMenu.Item>

				{canUsePendingActions && (
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={async () => {
							const result = await authClient.organization.cancelInvitation({
								invitationId: invitation.id,
							});

							if (result.error) {
								toast.error(result.error.message);
								return;
							}

							toast.success("Invitation canceled");
							await onChanged();
						}}
					>
						Cancel Invitation
					</DropdownMenu.Item>
				)}

				<DropdownMenu.Item
					className="w-full cursor-pointer"
					onSelect={async () => {
						await onRemove();
						toast.success("Invitation removed");
					}}
				>
					Remove Invitation
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu>
	);
};
