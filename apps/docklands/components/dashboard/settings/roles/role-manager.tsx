import { Button } from "@cloudflare/kumo/components/button";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleRole } from "./handle-role";

const permissionCount = (permissions: Record<string, string[]>) =>
	Object.values(permissions).reduce(
		(total, actions) => total + actions.length,
		0,
	);

export const RoleManager = () => {
	const utils = api.useUtils();
	const { data: roles, isPending } = api.customRole.all.useQuery();
	const { mutateAsync: removeRole, isPending: isRemoving } =
		api.customRole.remove.useMutation();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div>
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<ShieldCheck className="size-6 text-kumo-subtle self-center" />
						Roles
					</h3>
					<p>
						Define custom roles with specific capabilities, then assign them to
						members. The built-in owner, admin, and member roles cannot be
						edited.
					</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : !roles || roles.length === 0 ? (
						<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center">
							<ShieldCheck className="size-6 text-kumo-subtle" />
							<span className="text-base text-kumo-subtle text-center">
								No custom roles yet. Create a role to grant members capabilities
								beyond the read-only default.
							</span>
							<HandleRole />
						</div>
					) : (
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
												<span className="text-xs text-kumo-subtle">
													{permissionCount(role.permissions)} permission
													{permissionCount(role.permissions) === 1 ? "" : "s"}
													{" · "}
													{role.memberCount} member
													{role.memberCount === 1 ? "" : "s"}
												</span>
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
															.catch(() => {
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
				</div>
			</div>
		</div>
	);
};
