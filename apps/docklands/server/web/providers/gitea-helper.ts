import { createLogger } from "@/server/core/lib/logger";
import { findGiteaById } from "@/server/core/services/gitea";
import { redirectResponse } from "@/server/web/request";

const logger = createLogger("gitea-helper");

export interface Gitea {
	giteaId: string;
	gitProviderId: string;
	redirectUri: string | null;
	accessToken: string | null;
	refreshToken: string | null;
	expiresAt: number | null;
	giteaUrl: string;
	giteaInternalUrl: string | null;
	clientId: string | null;
	clientSecret: string | null;
	organizationName?: string;
	gitProvider: {
		name: string;
		gitProviderId: string;
		providerType: "github" | "gitlab" | "bitbucket" | "gitea";
		createdAt: string;
		organizationId: string;
	};
}

export const findGitea = async (giteaId: string): Promise<Gitea | null> => {
	try {
		const gitea = await findGiteaById(giteaId);
		return gitea;
	} catch (findError) {
		logger.error(
			{ err: findError, provider: "gitea", giteaId },
			"Error finding Gitea provider",
		);
		return null;
	}
};

export const redirectWithError = (request: Request, error: string) =>
	redirectResponse(
		request,
		`/dashboard/settings/git-providers?error=${encodeURIComponent(error)}`,
	);

export default findGitea;
