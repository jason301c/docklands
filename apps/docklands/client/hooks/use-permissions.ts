import { api } from "@/client/api/trpc";

/**
 * Shared accessor for the current member's resolved permissions
 * (`api.user.getPermissions`).
 *
 * Returns the same permissions object the query yields, so existing
 * `permissions?.<resource>.<action>` access keeps working unchanged. The `can`
 * helper is a convenience for the common `!!permissions?.[resource]?.[action]`
 * boolean lookup. React Query dedupes the underlying query, so wrapping it is
 * behavior-identical to calling `api.user.getPermissions.useQuery()` inline.
 */
export const usePermissions = () => {
	const { data: permissions, isLoading } = api.user.getPermissions.useQuery();

	const can = (resource: string, action: string): boolean => {
		const resourcePermissions = (
			permissions as Record<string, Record<string, boolean> | undefined>
		)?.[resource];
		return !!resourcePermissions?.[action];
	};

	return { permissions, can, isLoading };
};
