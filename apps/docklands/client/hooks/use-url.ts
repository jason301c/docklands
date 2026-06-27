import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";

/**
 * Returns the base URL Docklands is reachable at.
 *
 * The value comes from the server-side single source of truth
 * (`settings.getInstanceUrl` → `server/core/services/instance-url.ts`), which
 * resolves the operator-configured instance URL. This matters because provider
 * integrations (GitHub App manifest, GitLab/Gitea OAuth + webhooks) bake this
 * URL into the provider's config at creation time, so it must be the URL the
 * provider can actually call back to — not whatever host the admin happens to be
 * browsing from. Deriving it from `window.location` breaks setups performed over
 * localhost or an internal IP.
 *
 * `window.location.origin` is used only as a transient placeholder while the
 * query is loading; once resolved, the server value always wins. This is the one
 * sanctioned client-side `window.location` fallback (see the instance-url guard
 * test).
 */
export const useUrl = () => {
	const [fallbackUrl, setFallbackUrl] = useState("");
	const { data } = api.settings.getInstanceUrl.useQuery();

	useEffect(() => {
		setFallbackUrl(`${window.location.protocol}//${window.location.host}`);
	}, []);

	return data?.url ?? fallbackUrl;
};
