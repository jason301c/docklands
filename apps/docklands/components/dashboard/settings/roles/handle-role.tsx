import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Loader2Icon, PenBoxIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";

type PermissionMap = Record<string, string[]>;
type Statements = Record<string, readonly string[]>;

type PermissionGroupConfig = {
	id: string;
	label: string;
	description: string;
	resources: readonly string[];
};

type PermissionResource = {
	groupId: string;
	groupLabel: string;
	resource: string;
	actions: readonly string[];
};

type PermissionGroup = Omit<PermissionGroupConfig, "resources"> & {
	resources: PermissionResource[];
};

const PERMISSION_GROUPS = [
	{
		id: "services",
		label: "Services",
		description:
			"Workspaces, environments, deployed services, logs, variables, domains, and backups.",
		resources: [
			"workspace",
			"environment",
			"service",
			"deployment",
			"logs",
			"monitoring",
			"envVars",
			"workspaceEnvVars",
			"environmentEnvVars",
			"domain",
			"volume",
			"backup",
			"volumeBackup",
			"tag",
		],
	},
	{
		id: "team",
		label: "Team",
		description: "Members, invitations, teams, and custom access rules.",
		resources: ["member", "invitation", "team", "ac"],
	},
	{
		id: "connections",
		label: "Connections",
		description:
			"Git providers, image registries, storage providers, certificates, SSH keys, and notifications.",
		resources: [
			"gitProviders",
			"registry",
			"destination",
			"certificate",
			"sshKeys",
			"notification",
			"api",
		],
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
		description:
			"Container runtime, runtime workers, ingress files, Cloudflare tunnels, and audit logs.",
		resources: [
			"docker",
			"runtimeWorker",
			"traefikFiles",
			"tunnel",
			"auditLog",
			"organization",
		],
	},
] satisfies readonly PermissionGroupConfig[];

const DEFAULT_PERMISSION_GROUP_ID = "services";

const RESOURCE_LABELS: Record<string, string> = {
	ac: "Access control",
	api: "API keys",
	auditLog: "Audit log",
	backup: "Database backups",
	certificate: "Certificates",
	deployment: "Deployments",
	destination: "Storage providers",
	docker: "Container runtime",
	domain: "Domains",
	environment: "Environments",
	environmentEnvVars: "Environment variables",
	envVars: "Service variables",
	gitProviders: "Git providers",
	invitation: "Invitations",
	logs: "Logs",
	member: "Members",
	monitoring: "Monitoring",
	notification: "Notifications",
	organization: "Organization",
	registry: "Image registry",
	runtimeWorker: "Runtime workers",
	service: "Services",
	sshKeys: "SSH keys",
	tag: "Tags",
	team: "Teams",
	traefikFiles: "Ingress files",
	tunnel: "Cloudflare tunnels",
	volume: "Volumes",
	volumeBackup: "Volume backups",
	workspace: "Workspaces",
	workspaceEnvVars: "Workspace variables",
};

const ACTION_LABELS: Record<string, string> = {
	cancel: "Cancel",
	create: "Create",
	delete: "Delete",
	read: "Read",
	restore: "Restore",
	update: "Update",
	write: "Write",
};

const ACTION_DESCRIPTIONS: Record<string, (resource: string) => string> = {
	read: (resource) => `View ${resource} and their details.`,
	create: (resource) => `Create new ${resource}.`,
	update: (resource) => `Edit existing ${resource}.`,
	write: (resource) => `Change ${resource} and their values.`,
	delete: (resource) => `Permanently delete ${resource}.`,
	cancel: (resource) => `Cancel in-progress ${resource}.`,
	restore: (resource) => `Restore ${resource} from a backup.`,
};

const formatResourceLabel = (resource: string) =>
	RESOURCE_LABELS[resource] ??
	resource
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/^./, (char) => char.toUpperCase());

const formatActionLabel = (action: string) =>
	ACTION_LABELS[action] ?? action.replace(/^./, (char) => char.toUpperCase());

const formatActionDescription = (action: string, resource: string) => {
	const resourceLabel = formatResourceLabel(resource).toLowerCase();
	return (
		ACTION_DESCRIPTIONS[action]?.(resourceLabel) ??
		`Allow ${formatActionLabel(action).toLowerCase()} on ${resourceLabel}.`
	);
};

const permissionCount = (permissions: PermissionMap) =>
	Object.values(permissions).reduce(
		(total, actions) => total + actions.length,
		0,
	);

const permissionCountForResources = (
	resources: readonly PermissionResource[],
	permissions: PermissionMap,
) =>
	resources.reduce(
		(total, item) => total + (permissions[item.resource]?.length ?? 0),
		0,
	);

const statementCount = (statements: Statements | undefined) =>
	statements
		? Object.values(statements).reduce(
				(total, actions) => total + actions.length,
				0,
			)
		: 0;

const groupStatements = (statements: Statements): PermissionGroup[] => {
	const knownResources = new Set<string>();
	const groups = PERMISSION_GROUPS.map((group) => {
		const resources = group.resources.flatMap((resource) => {
			knownResources.add(resource);
			const actions = statements[resource];
			return actions
				? [
						{
							groupId: group.id,
							groupLabel: group.label,
							resource,
							actions,
						},
					]
				: [];
		});
		return { ...group, resources };
	}).filter((group) => group.resources.length > 0);

	const otherResources = Object.entries(statements)
		.filter(([resource]) => !knownResources.has(resource))
		.map(([resource, actions]) => ({
			groupId: "other",
			groupLabel: "Other",
			resource,
			actions,
		}));

	if (otherResources.length > 0) {
		groups.push({
			id: "other",
			label: "Other",
			description: "Additional capabilities exposed by access control.",
			resources: otherResources,
		});
	}

	return groups;
};

function PermissionCategoryTabs({
	groups,
	activeGroupId,
	permissions,
	onSelect,
}: {
	groups: readonly PermissionGroup[];
	activeGroupId: string;
	permissions: PermissionMap;
	onSelect: (groupId: string) => void;
}) {
	const tabs = groups.map((group) => {
		const selected = permissionCountForResources(group.resources, permissions);
		return {
			value: group.id,
			label: (
				<span className="flex items-center gap-2">
					<span>{group.label}</span>
					<span className="text-xs tabular-nums text-kumo-subtle">
						{selected}
					</span>
				</span>
			),
		};
	});

	return <Tabs tabs={tabs} value={activeGroupId} onValueChange={onSelect} />;
}

function PermissionResourceSection({
	item,
	showGroupLabel,
	selectedActions,
	onToggleAction,
	onToggleResource,
}: {
	item: PermissionResource;
	showGroupLabel: boolean;
	selectedActions: string[];
	onToggleAction: (action: string, checked: boolean) => void;
	onToggleResource: (checked: boolean) => void;
}) {
	const allSelected = selectedActions.length === item.actions.length;
	return (
		<section className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base">
			<header className="flex items-center justify-between gap-3 border-b border-kumo-line bg-kumo-elevated px-4 py-3">
				<div className="min-w-0">
					<div className="font-semibold text-kumo-default text-sm">
						{formatResourceLabel(item.resource)}
					</div>
					<div className="text-kumo-subtle text-xs">
						{showGroupLabel ? `${item.groupLabel} · ` : ""}
						{selectedActions.length}/{item.actions.length} enabled
					</div>
				</div>
				<Switch
					aria-label={`Enable all ${formatResourceLabel(item.resource)} permissions`}
					checked={allSelected}
					onCheckedChange={(checked) => onToggleResource(!!checked)}
				/>
			</header>
			<div className="divide-y divide-kumo-line">
				{item.actions.map((action) => (
					<div
						key={action}
						className="flex items-center justify-between gap-4 px-4 py-3"
					>
						<div className="min-w-0">
							<div className="font-medium text-kumo-default text-sm">
								{formatActionLabel(action)}
							</div>
							<div className="text-kumo-subtle text-xs">
								{formatActionDescription(action, item.resource)}
							</div>
						</div>
						<Switch
							aria-label={`${formatActionLabel(action)} ${formatResourceLabel(item.resource)}`}
							checked={selectedActions.includes(action)}
							onCheckedChange={(checked) => onToggleAction(action, !!checked)}
						/>
					</div>
				))}
			</div>
		</section>
	);
}

interface Props {
	role?: { role: string; permissions: PermissionMap };
}

export const HandleRole = ({ role }: Props) => {
	const isEdit = !!role;
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const [name, setName] = useState(role?.role ?? "");
	const [perms, setPerms] = useState<PermissionMap>(role?.permissions ?? {});
	const [activeGroupId, setActiveGroupId] = useState(
		DEFAULT_PERMISSION_GROUP_ID,
	);

	const statementsQuery = api.customRole.getStatements.useQuery(undefined, {
		enabled: isOpen,
	});
	const statements = statementsQuery.data as Statements | undefined;

	const createMutation = api.customRole.create.useMutation(
		crudMutationOptions({
			successMessage: "Role created",
			errorMessage: "Error creating role",
			loggerScope: "roles",
			invalidate: () => utils.customRole.all.invalidate(),
			onSuccess: () => setIsOpen(false),
			toastError: false,
		}),
	);

	const updateMutation = api.customRole.update.useMutation(
		crudMutationOptions({
			successMessage: "Role updated",
			errorMessage: "Error updating role",
			loggerScope: "roles",
			invalidate: () => utils.customRole.all.invalidate(),
			onSuccess: () => setIsOpen(false),
			toastError: false,
		}),
	);

	const activeError = isEdit ? updateMutation.error : createMutation.error;
	const activeIsError = isEdit
		? updateMutation.isError
		: createMutation.isError;
	const isSubmitting = createMutation.isPending || updateMutation.isPending;
	const selectedPermissionCount = permissionCount(perms);
	const totalPermissionCount = statementCount(statements);

	const permissionGroups = useMemo(
		() => (statements ? groupStatements(statements) : []),
		[statements],
	);

	const activeGroup =
		permissionGroups.find((group) => group.id === activeGroupId) ??
		permissionGroups[0];

	const visibleResources = activeGroup?.resources ?? [];

	useEffect(() => {
		if (isOpen) {
			setName(role?.role ?? "");
			setPerms(role?.permissions ?? {});
			setActiveGroupId(DEFAULT_PERMISSION_GROUP_ID);
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

			const orderedActions = statements?.[resource]?.filter((candidate) =>
				current.has(candidate),
			) ?? [...current];
			const next = { ...prev };
			if (orderedActions.length > 0) {
				next[resource] = orderedActions;
			} else {
				delete next[resource];
			}
			return next;
		});
	};

	const selectResources = (resources: readonly PermissionResource[]) => {
		setPerms((prev) => {
			const next = { ...prev };
			for (const item of resources) {
				next[item.resource] = [...item.actions];
			}
			return next;
		});
	};

	const clearResources = (resources: readonly PermissionResource[]) => {
		setPerms((prev) => {
			const next = { ...prev };
			for (const item of resources) {
				delete next[item.resource];
			}
			return next;
		});
	};

	const onSubmit = () => {
		const roleName = name.trim();
		if (!roleName) return;

		if (isEdit && role) {
			updateMutation.mutate({
				roleName: role.role,
				newRoleName: roleName !== role.role ? roleName : undefined,
				permissions: perms,
			});
			return;
		}

		createMutation.mutate({
			roleName,
			permissions: perms,
		});
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
							<Button variant="primary">
								<PlusIcon className="h-4 w-4" />
								Create role
							</Button>
						) as never)
					)
				}
			/>
			<Dialog className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
				<Dialog.Header className="mb-0 border-b border-kumo-line pb-4">
					<Dialog.Title>{isEdit ? "Update" : "Create"} role</Dialog.Title>
					<Dialog.Description>
						Toggle exactly what this role is allowed to do.
					</Dialog.Description>
				</Dialog.Header>

				<div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
					{activeIsError && (
						<AlertBlock type="error">{activeError?.message}</AlertBlock>
					)}

					<Input
						id="role-name"
						label="Role name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="e.g., deployer"
					/>

					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						<span className="font-medium text-kumo-default">
							Quick actions:
						</span>
						<button
							type="button"
							disabled={
								statementsQuery.isPending ||
								selectedPermissionCount === totalPermissionCount
							}
							onClick={() =>
								selectResources(
									permissionGroups.flatMap((group) => group.resources),
								)
							}
							className="text-kumo-brand hover:underline disabled:text-kumo-subtle disabled:no-underline"
						>
							Select all
						</button>
						<button
							type="button"
							disabled={selectedPermissionCount === 0}
							onClick={() => setPerms({})}
							className="text-kumo-brand hover:underline disabled:text-kumo-subtle disabled:no-underline"
						>
							Clear all
						</button>
					</div>

					<div className="space-y-3">
						{permissionGroups.length > 0 && (
							<div className="flex">
								<PermissionCategoryTabs
									groups={permissionGroups}
									activeGroupId={activeGroup?.id ?? activeGroupId}
									permissions={perms}
									onSelect={(groupId) => setActiveGroupId(groupId)}
								/>
							</div>
						)}

						<div className="max-h-[46vh] overflow-auto">
							{statementsQuery.isPending ? (
								<div className="flex min-h-64 items-center justify-center gap-2 text-sm text-kumo-subtle">
									<span>Loading permissions...</span>
									<Loader2Icon className="size-4 animate-spin" />
								</div>
							) : statementsQuery.isError ? (
								<div className="flex min-h-64 flex-col items-center justify-center gap-3 p-4">
									<AlertBlock type="error" className="w-full max-w-md">
										{statementsQuery.error?.message ??
											"Permissions could not be loaded."}
									</AlertBlock>
									<Button
										type="button"
										variant="secondary"
										onClick={() => statementsQuery.refetch()}
									>
										Try again
									</Button>
								</div>
							) : visibleResources.length === 0 ? (
								<div className="flex min-h-64 items-center justify-center text-sm text-kumo-subtle">
									No permissions in this category.
								</div>
							) : (
								<div className="space-y-3">
									{visibleResources.map((item) => (
										<PermissionResourceSection
											key={item.resource}
											item={item}
											showGroupLabel={false}
											selectedActions={perms[item.resource] ?? []}
											onToggleAction={(action, checked) =>
												toggle(item.resource, action, checked)
											}
											onToggleResource={(checked) =>
												checked
													? selectResources([item])
													: clearResources([item])
											}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				<Dialog.Footer className="mt-4 border-t border-kumo-line pt-4">
					<div className="mr-auto hidden text-sm text-kumo-subtle sm:block">
						{selectedPermissionCount} capabilities selected
					</div>
					<Dialog.Close
						render={
							<Button type="button" variant="secondary">
								Cancel
							</Button>
						}
					/>
					<Button
						type="button"
						variant="primary"
						onClick={onSubmit}
						disabled={!name.trim()}
						loading={isSubmitting}
					>
						{isEdit ? "Save role" : "Create role"}
					</Button>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
