import { api } from "@/client/api/trpc";

/**
 * Shared accessor for the current member (`api.user.get`).
 *
 * Many components fetch the current member just to derive whether the viewer is
 * a privileged owner/admin. Centralize that here so the `role === "owner" ||
 * role === "admin"` test (the client mirror of the server's `isOwnerOrAdmin`)
 * lives in one place. React Query dedupes the underlying query, so wrapping it
 * is behavior-identical to calling `api.user.get.useQuery()` inline.
 */
export const useCurrentUser = () => {
	const { data: user, isLoading } = api.user.get.useQuery();

	const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

	return { user, isOwnerOrAdmin, isLoading };
};
