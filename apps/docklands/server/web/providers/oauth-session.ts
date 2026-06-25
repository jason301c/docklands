import { validateRequestHeaders } from "@/server/core/lib/auth";
import type { OAuthStateContext } from "./oauth-state";

export type ProviderOAuthSession = {
	userId: string;
	activeOrganizationId: string;
};

export const getProviderOAuthSession = async (
	request: Request,
): Promise<ProviderOAuthSession | null> => {
	const { user, session } = await validateRequestHeaders(request.headers);
	if (!user || !session?.activeOrganizationId) return null;
	return {
		userId: user.id,
		activeOrganizationId: session.activeOrganizationId,
	};
};

export const oauthStateMatchesSession = (
	state: OAuthStateContext,
	session: ProviderOAuthSession,
) =>
	state.userId === session.userId &&
	state.organizationId === session.activeOrganizationId;
