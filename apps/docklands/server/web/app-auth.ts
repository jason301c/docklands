import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IS_CLOUD } from "@/server/core/constants/env";
import type { statements } from "@/server/core/lib/access-control";
import { validateRequestHeaders } from "@/server/core/lib/auth";
import { hasPermission } from "@/server/core/services/permission";

type Resource = keyof typeof statements;
type ActionOf<R extends Resource> = (typeof statements)[R][number];

export const getAppSession = async () => {
	const requestHeaders = await headers();
	return validateRequestHeaders(requestHeaders);
};

export const requireUser = async () => {
	const { user, session } = await getAppSession();
	if (!user || !session) {
		redirect("/");
	}

	return { user, session };
};

export const redirectAuthenticatedUser = async () => {
	const { user } = await getAppSession();
	if (user) {
		redirect("/dashboard/home");
	}
};

export const requireAdmin = async () => {
	const auth = await requireUser();
	if (auth.user.role === "member") {
		redirect("/dashboard/settings/profile");
	}

	return auth;
};

export const requireSelfHosted = () => {
	if (IS_CLOUD) {
		redirect("/dashboard/home");
	}
};

export const requireSelfHostedAdmin = async () => {
	requireSelfHosted();
	return requireAdmin();
};

export const requirePermission = async <R extends Resource>(
	resource: R,
	action: ActionOf<R>,
	redirectTo = "/",
) => {
	const auth = await requireUser();
	const permitted = await hasPermission(
		{
			user: { id: auth.user.id },
			session: {
				activeOrganizationId: auth.session.activeOrganizationId || "",
			},
		},
		{ [resource]: [action] } as any,
	);

	if (!permitted) {
		redirect(redirectTo);
	}

	return auth;
};
