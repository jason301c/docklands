import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import {
	type MemberResourceAccessType,
	member,
	memberResourceAccess,
	organizationRole,
} from "@/server/core/db/schema";
import {
	ac,
	adminRole,
	memberRole,
	ownerRole,
	statements,
} from "../lib/access-control";

/**
 * Owner and admin are the privileged roles that bypass per-resource access
 * scoping. Use this instead of inlining the role comparison.
 */
export const isOwnerOrAdmin = (role: string | null | undefined): boolean =>
	role === "owner" || role === "admin";

type Statements = typeof statements;
type Resource = keyof Statements;
type Action<R extends Resource> = Statements[R][number];
type Permissions = {
	[R in Resource]?: Action<R>[];
};

/**
 * Merge a parsed permission map into an accumulator, unioning the action list
 * per resource. The accumulator is keyed by the canonical {@link Resource}
 * union so only known resources/actions are representable. We work through an
 * untyped index inside this single helper because iterating a heterogeneous
 * keyed record collapses each resource's action type to the (empty)
 * intersection of all of them; the input/output stay strongly typed.
 */
const mergePermissions = (target: Permissions, source: Permissions): void => {
	const acc = target as Record<Resource, string[] | undefined>;
	for (const resource of Object.keys(source) as Resource[]) {
		const actions = (source as Record<Resource, string[] | undefined>)[
			resource
		];
		if (!actions) {
			continue;
		}
		acc[resource] = [...new Set([...(acc[resource] ?? []), ...actions])];
	}
};

export type PermissionCtx = {
	user: { id: string };
	session: { activeOrganizationId: string };
};

export type ResolvedPermissions = {
	[R in Resource]: {
		[A in Statements[R][number]]: boolean;
	};
};

const staticRoles: Record<string, ReturnType<typeof ac.newRole>> = {
	owner: ownerRole,
	admin: adminRole,
	member: memberRole,
};

const resolveRole = async (
	roleName: string,
	organizationId: string,
): Promise<ReturnType<typeof ac.newRole> | null> => {
	if (staticRoles[roleName]) {
		return staticRoles[roleName];
	}

	const customRoles = await db.query.organizationRole.findMany({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, roleName),
		),
	});

	if (customRoles.length === 0) {
		return null;
	}

	const merged: Permissions = {};
	for (const entry of customRoles) {
		// `organization_role.permission` is validated against `statements`
		// (resource × action) before it is persisted (see custom-role router),
		// so the parsed JSON conforms to the `Permissions` shape here.
		const parsed = JSON.parse(entry.permission) as Permissions;
		mergePermissions(merged, parsed);
	}

	return ac.newRole(merged);
};

export const checkPermission = async (
	ctx: PermissionCtx,
	permissions: Permissions,
) => {
	const { id: userId } = ctx.user;
	const { activeOrganizationId: organizationId } = ctx.session;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	const role = await resolveRole(memberRecord.role, organizationId);

	if (!role) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Invalid role",
		});
	}

	const result = role.authorize(permissions);
	if (result.success) {
		return;
	}

	throw new TRPCError({
		code: "UNAUTHORIZED",
		message: result.error || "Permission denied",
	});
};

export const hasPermission = async (
	ctx: PermissionCtx,
	permissions: Permissions,
): Promise<boolean> => {
	try {
		await checkPermission(ctx, permissions);
		return true;
	} catch {
		return false;
	}
};

export const resolvePermissions = async (
	ctx: PermissionCtx,
): Promise<ResolvedPermissions> => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	const role = await resolveRole(memberRecord.role, organizationId);

	const result = {} as ResolvedPermissions;
	// View `result` through a uniform per-resource shape while we fill it in:
	// iterating the heterogeneous `ResolvedPermissions` keyed record would
	// otherwise collapse each resource's action map to their intersection. The
	// returned value keeps the precise `ResolvedPermissions` type.
	const resultAcc = result as Record<Resource, Record<string, boolean>>;

	for (const resource of Object.keys(statements) as Resource[]) {
		const resourcePerms: Record<string, boolean> = {};
		for (const action of statements[resource]) {
			resourcePerms[action] = role
				? role.authorize({ [resource]: [action] }).success
				: false;
		}
		resultAcc[resource] = resourcePerms;
	}

	return result;
};

export const checkWorkspaceAccess = async (
	ctx: PermissionCtx,
	action: "create" | "delete",
	workspaceId?: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { workspace: [action] });

	if (
		action !== "create" &&
		workspaceId &&
		!isOwnerOrAdmin(memberRecord.role)
	) {
		if (!memberRecord.accessedWorkspaces.includes(workspaceId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this workspace",
			});
		}
	}
};

export const checkServicePermissionAndAccess = async (
	ctx: PermissionCtx,
	serviceId: string,
	permissions: Permissions,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);
	await checkPermission(ctx, permissions);
	if (!isOwnerOrAdmin(memberRecord.role)) {
		if (!memberRecord.accessedServices.includes(serviceId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this service",
			});
		}
	}
};

export const checkServiceAccess = async (
	ctx: PermissionCtx,
	serviceId: string,
	action: "create" | "read" | "delete" = "read",
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { service: [action] });

	if (!isOwnerOrAdmin(memberRecord.role)) {
		if (action === "create") {
			if (!memberRecord.accessedWorkspaces.includes(serviceId)) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You don't have access to this workspace",
				});
			}
		} else {
			if (!memberRecord.accessedServices.includes(serviceId)) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You don't have access to this service",
				});
			}
		}
	}
};

export const checkEnvironmentAccess = async (
	ctx: PermissionCtx,
	environmentId: string,
	action: "read" | "create" | "delete" = "read",
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: [action] });

	if (action !== "create" && !isOwnerOrAdmin(memberRecord.role)) {
		if (!memberRecord.accessedEnvironments.includes(environmentId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this environment",
			});
		}
	}
};

export const checkEnvironmentCreationPermission = async (
	ctx: PermissionCtx,
	workspaceId: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: ["create"] });

	if (!isOwnerOrAdmin(memberRecord.role)) {
		if (!memberRecord.accessedWorkspaces.includes(workspaceId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this workspace",
			});
		}
	}
};

export const checkEnvironmentDeletionPermission = async (
	ctx: PermissionCtx,
	workspaceId: string,
) => {
	const userId = ctx.user.id;
	const organizationId = ctx.session.activeOrganizationId;
	const memberRecord = await findMemberByUserId(userId, organizationId);

	await checkPermission(ctx, { environment: ["delete"] });

	if (!isOwnerOrAdmin(memberRecord.role)) {
		if (!memberRecord.accessedWorkspaces.includes(workspaceId)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this workspace",
			});
		}
	}
};

export const addNewWorkspace = async (
	ctx: PermissionCtx,
	workspaceId: string,
) => {
	const memberRecord = await findMemberByUserId(
		ctx.user.id,
		ctx.session.activeOrganizationId,
	);
	await grantResourceAccess(
		memberRecord.id,
		ctx.session.activeOrganizationId,
		"workspace",
		workspaceId,
	);
};

export const addNewEnvironment = async (
	ctx: PermissionCtx,
	environmentId: string,
) => {
	const memberRecord = await findMemberByUserId(
		ctx.user.id,
		ctx.session.activeOrganizationId,
	);
	await grantResourceAccess(
		memberRecord.id,
		ctx.session.activeOrganizationId,
		"environment",
		environmentId,
	);
};

export const addNewService = async (ctx: PermissionCtx, serviceId: string) => {
	const memberRecord = await findMemberByUserId(
		ctx.user.id,
		ctx.session.activeOrganizationId,
	);
	await grantResourceAccess(
		memberRecord.id,
		ctx.session.activeOrganizationId,
		"service",
		serviceId,
	);
};

const ACCESS_FIELD_BY_TYPE = {
	workspace: "accessedWorkspaces",
	environment: "accessedEnvironments",
	service: "accessedServices",
	gitProvider: "accessedGitProviders",
	runtimeWorker: "accessedRuntimeWorkers",
} as const satisfies Record<MemberResourceAccessType, string>;

export type ResourceAccessLists = {
	accessedWorkspaces: string[];
	accessedEnvironments: string[];
	accessedServices: string[];
	accessedGitProviders: string[];
	accessedRuntimeWorkers: string[];
};

/**
 * Load a member's per-resource access scoping from the normalized
 * `member_resource_access` table and project it back into the legacy array
 * shape (`accessedWorkspaces`, `accessedServices`, ...) that the rest of the
 * codebase consumes. This keeps every existing `.includes()`/SQL-filter call
 * site working unchanged after the columns were removed from the member row.
 */
export const loadResourceAccess = async (
	memberId: string,
): Promise<ResourceAccessLists> => {
	const rows = await db.query.memberResourceAccess.findMany({
		where: eq(memberResourceAccess.memberId, memberId),
		columns: { resourceType: true, resourceId: true },
	});
	const lists: ResourceAccessLists = {
		accessedWorkspaces: [],
		accessedEnvironments: [],
		accessedServices: [],
		accessedGitProviders: [],
		accessedRuntimeWorkers: [],
	};
	for (const row of rows) {
		const field = ACCESS_FIELD_BY_TYPE[row.resourceType];
		if (field) {
			lists[field].push(row.resourceId);
		}
	}
	return lists;
};

/**
 * Returns the scoped resource ids of a given type for a member, plus the
 * member's role so callers can apply the owner/admin bypass. Used by the few
 * services that previously read a single `accessed*` column directly.
 */
export const getMemberResourceAccessSet = async (
	userId: string,
	organizationId: string,
	resourceType: MemberResourceAccessType,
): Promise<{ role: string | null; ids: Set<string> }> => {
	const memberRecord = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, organizationId),
		),
		columns: { id: true, role: true },
	});
	if (!memberRecord) {
		return { role: null, ids: new Set() };
	}
	const rows = await db.query.memberResourceAccess.findMany({
		where: and(
			eq(memberResourceAccess.memberId, memberRecord.id),
			eq(memberResourceAccess.resourceType, resourceType),
		),
		columns: { resourceId: true },
	});
	return {
		role: memberRecord.role,
		ids: new Set(rows.map((r) => r.resourceId)),
	};
};

const grantResourceAccess = async (
	memberId: string,
	organizationId: string,
	resourceType: MemberResourceAccessType,
	resourceId: string,
) => {
	await db
		.insert(memberResourceAccess)
		.values({ memberId, organizationId, resourceType, resourceId })
		.onConflictDoNothing();
};

/**
 * Replace the full set of granted ids of a given type for a member. Used by the
 * permissions editor: `undefined` leaves that type untouched.
 */
export const syncMemberResourceAccess = async (
	memberId: string,
	organizationId: string,
	updates: Partial<Record<MemberResourceAccessType, string[]>>,
) => {
	for (const [resourceType, ids] of Object.entries(updates) as [
		MemberResourceAccessType,
		string[] | undefined,
	][]) {
		if (ids === undefined) {
			continue;
		}
		await db
			.delete(memberResourceAccess)
			.where(
				and(
					eq(memberResourceAccess.memberId, memberId),
					eq(memberResourceAccess.resourceType, resourceType),
				),
			);
		const unique = [...new Set(ids)];
		if (unique.length > 0) {
			await db.insert(memberResourceAccess).values(
				unique.map((resourceId) => ({
					memberId,
					organizationId,
					resourceType,
					resourceId,
				})),
			);
		}
	}
};

export const findMemberByUserId = async (
	userId: string,
	organizationId: string,
) => {
	const result = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, organizationId),
		),
		with: {
			user: true,
		},
	});

	if (!result) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Permission denied",
		});
	}
	return { ...result, ...(await loadResourceAccess(result.id)) };
};
