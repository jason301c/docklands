import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";

/**
 * Returns the base URL Docklands is reachable at.
 *
 * Provider integrations (GitHub App manifest, GitLab/Gitea OAuth + webhooks)
 * bake this URL into the provider's config at creation time, so it must be the
 * URL the provider can actually call back to — not whatever host the admin
 * happens to be browsing from. Deriving it purely from `window.location` breaks
 * setups performed over localhost or an internal IP.
 *
 * We therefore prefer the configured app URL from the web-server settings (the
 * same `host`/`https`/`serverIp` that `getDocklandsUrl()` uses server-side) and
 * fall back to the current origin only when no URL has been configured yet.
 */
export const useUrl = () => {
	const [fallbackUrl, setFallbackUrl] = useState("");
	const { data: settings } = api.settings.getWebServerSettings.useQuery();

	useEffect(() => {
		const protocolAndHost = `${window.location.protocol}//${window.location.host}`;
		setFallbackUrl(protocolAndHost);
	}, []);

	if (settings?.host) {
		const protocol = settings.https ? "https" : "http";
		return `${protocol}://${settings.host}`;
	}

	return fallbackUrl;
};
