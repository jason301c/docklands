import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("roles");

interface Props {
	role?: { role: string; permissions: Record<string, string[]> };
}

export const HandleRole = ({ role }: Props) => {
	const isEdit = !!role;
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const [name, setName] = useState(role?.role ?? "");
	const [perms, setPerms] = useState<Record<string, string[]>>(
		role?.permissions ?? {},
	);

	const { data: statements } = api.customRole.getStatements.useQuery(
		undefined,
		{
			enabled: isOpen,
		},
	);

	const createMutation = api.customRole.create.useMutation();
	const updateMutation = api.customRole.update.useMutation();
	const { error, isError } = isEdit ? updateMutation : createMutation;

	useEffect(() => {
		if (isOpen) {
			setName(role?.role ?? "");
			setPerms(role?.permissions ?? {});
		}
	}, [isOpen, role]);

	const toggle = (resource: string, action: string, checked: boolean) => {
		setPerms((prev) => {
			const current = new Set(prev[resource] ?? []);
			if (checked) {
				current.add(action);
			} else {
				current.delete(action);
			}
			const next = { ...prev };
			if (current.size > 0) {
				next[resource] = [...current];
			} else {
				delete next[resource];
			}
			return next;
		});
	};

	const onSubmit = async () => {
		try {
			if (isEdit && role) {
				await updateMutation.mutateAsync({
					roleName: role.role,
					newRoleName: name !== role.role ? name : undefined,
					permissions: perms,
				});
			} else {
				await createMutation.mutateAsync({
					roleName: name,
					permissions: perms,
				});
			}
			await utils.customRole.all.invalidate();
			toast.success(isEdit ? "Role updated" : "Role created");
			setIsOpen(false);
		} catch (err) {
			logger.error(err);
			toast.error(isEdit ? "Error updating role" : "Error creating role");
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					isEdit ? (
						<Button
							aria-label="Edit role"
							variant="ghost"
							shape="square"
							className="h-8 w-8"
						>
							<PenBoxIcon className="h-4 w-4" />
						</Button>
					) : (
						((
							<Button>
								<PlusIcon className="h-4 w-4" />
								Create role
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="sm:max-w-2xl max-h-[85vh]">
				<Dialog.Header>
					<Dialog.Title>{isEdit ? "Update" : "Create"} role</Dialog.Title>
					<Dialog.Description>
						Choose the capabilities this role grants. Members assigned this role
						gain exactly these permissions.
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<div className="grid w-full gap-4">
					<div className="grid gap-2">
						<label htmlFor="role-name" className="text-sm font-medium">
							Role name
						</label>
						<Input
							id="role-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., deployer"
						/>
					</div>
					<div className="flex flex-col gap-1 overflow-y-auto max-h-[50vh] rounded-lg border p-3">
						{!statements ? (
							<span className="text-sm text-kumo-subtle">Loading…</span>
						) : (
							Object.entries(statements).map(([resource, actions]) => (
								<div
									key={resource}
									className="flex flex-col gap-1.5 border-b py-2 last:border-b-0"
								>
									<span className="text-sm font-medium">{resource}</span>
									<div className="flex flex-row flex-wrap gap-4">
										{(actions as readonly string[]).map((action) => {
											const checked = (perms[resource] ?? []).includes(action);
											return (
												<Checkbox
													key={action}
													label={action}
													checked={checked}
													onCheckedChange={(value) =>
														toggle(resource, action, !!value)
													}
													className="text-sm text-kumo-subtle"
												/>
											);
										})}
									</div>
								</div>
							))
						)}
					</div>
				</div>
				<Dialog.Footer>
					<Button
						onClick={onSubmit}
						disabled={!name.trim()}
						loading={createMutation.isPending || updateMutation.isPending}
					>
						{isEdit ? "Update" : "Create"}
					</Button>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
