import { api } from "@/client/api/trpc";
import type { PermissionsOutput } from "@/shared/dashboard-nav";

/** The resolved per-resource permission map (`{ deployment: { read: boolean, … }, … }`). */
type Permissions = NonNullable<PermissionsOutput>;
/** A permission resource, e.g. `"deployment"` | `"monitoring"`. */
type PermissionResource = keyof Permissions;

/**
 * Shared accessor for the current member's resolved permissions
 * (`api.user.getPermissions`).
 *
 * Returns the same permissions object the query yields, so existing
 * `permissions?.<resource>.<action>` access keeps working unchanged. The `can`
 * helper is a typed convenience for the common boolean lookup: the resource and
 * action are inferred from the server access-control statements, so a typo'd
 * resource/action fails at compile time instead of silently returning `false`.
 * React Query dedupes the underlying query, so wrapping it is behavior-identical
 * to calling `api.user.getPermissions.useQuery()` inline.
 */
export const usePermissions = () => {
	const { data: permissions, isLoading } = api.user.getPermissions.useQuery();

	const can = <R extends PermissionResource>(
		resource: R,
		action: keyof Permissions[R],
	): boolean => Boolean(permissions?.[resource]?.[action]);

	return { permissions, can, isLoading };
};
