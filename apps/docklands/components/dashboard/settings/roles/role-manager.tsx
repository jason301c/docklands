"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Loader2, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
import { DialogAction } from "@/components/shared/dialog-action";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("roles");

import { HandleRole } from "./handle-role";

const permissionCount = (permissions: Record<string, string[]>) =>
	Object.values(permissions).reduce(
		(total, actions) => total + actions.length,
		0,
	);

const memberDisplayName = (firstName: string | null, lastName: string | null) =>
	[firstName, lastName].filter(Boolean).join(" ").trim();

const RoleMembersDialog = ({
	roleName,
	memberCount,
}: {
	roleName: string;
	memberCount: number;
}) => {
	const [open, setOpen] = useState(false);
	const { data: members, isPending } = api.customRole.membersByRole.useQuery(
		{ roleName },
		{ enabled: open },
	);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				render={
					<Button variant="ghost" size="sm" className="gap-1.5">
						<Users className="size-3.5 text-kumo-subtle" />
						<span>
							{memberCount} member{memberCount === 1 ? "" : "s"}
						</span>
					</Button>
				}
			/>
			<Dialog className="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Members of "{roleName}"</Dialog.Title>
				</Dialog.Header>
				{isPending ? (
					<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[8rem]">
						<span>Loading...</span>
						<Loader2 className="animate-spin size-4" />
					</div>
				) : !members || members.length === 0 ? (
					<div className="flex flex-col items-center gap-2 min-h-[8rem] justify-center">
						<Users className="size-5 text-kumo-subtle" />
						<span className="text-sm text-kumo-subtle text-center">
							No members have this role.
						</span>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{members.map((member) => {
							const fullName = memberDisplayName(
								member.firstName,
								member.lastName,
							);
							return (
								<div
									key={member.id}
									className="flex flex-col gap-0.5 rounded-lg border bg-kumo-canvas p-3"
								>
									<span className="text-sm font-medium">{member.email}</span>
									{fullName ? (
										<span className="text-xs text-kumo-subtle">{fullName}</span>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</Dialog>
		</Dialog.Root>
	);
};

export const RoleManager = () => {
	const utils = api.useUtils();
	const rolesQuery = api.customRole.all.useQuery();
	const { mutateAsync: removeRole, isPending: isRemoving } =
		api.customRole.remove.useMutation();

	return (
		<SectionCard
			icon={ShieldCheck}
			title="Roles"
			description="Define custom roles with specific capabilities, then assign them to members. The built-in owner, admin, and member roles cannot be edited."
		>
			<QueryState
				query={rolesQuery}
				isEmpty={(roles) => roles.length === 0}
				empty={
					<EmptyState
						icon={ShieldCheck}
						title="No custom roles yet. Create a role to grant members capabilities beyond the read-only default."
						action={<HandleRole />}
					/>
				}
			>
				{(roles) => (
					<div className="flex flex-col gap-4 min-h-[25vh]">
						<div className="flex flex-col gap-4 rounded-lg">
							{roles.map((role) => (
								<div
									key={role.role}
									className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
								>
									<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border w-full">
										<div className="flex flex-col gap-1">
											<span className="text-sm font-medium">{role.role}</span>
											<div className="flex items-center gap-1 text-xs text-kumo-subtle">
												<span>
													{permissionCount(role.permissions)} permission
													{permissionCount(role.permissions) === 1 ? "" : "s"}
												</span>
												<span>·</span>
												<RoleMembersDialog
													roleName={role.role}
													memberCount={role.memberCount}
												/>
											</div>
										</div>
										<div className="flex flex-row gap-1 items-center">
											<HandleRole
												role={{
													role: role.role,
													permissions: role.permissions,
												}}
											/>
											<DialogAction
												title="Delete role"
												description={`Are you sure you want to delete "${role.role}"? Members with this role will be reset to the base member role. This action cannot be undone.`}
												type="destructive"
												onClick={async () => {
													await removeRole({ roleName: role.role })
														.then(async () => {
															await utils.customRole.all.invalidate();
															toast.success("Role deleted successfully");
														})
														.catch((err) => {
															logger.error(err);
															toast.error("Error deleting role");
														});
												}}
											>
												<Button
													aria-label="Delete role"
													variant="ghost"
													shape="square"
													className="group hover:bg-kumo-danger/10"
													loading={isRemoving}
												>
													<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
												</Button>
											</DialogAction>
										</div>
									</div>
								</div>
							))}
						</div>

						<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
							<HandleRole />
						</div>
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
};
