import { redirect } from "next/navigation";
import { IS_CLOUD } from "@/server/core/constants/env";
import { isAdminPresent } from "@/server/core/services/admin";
import { redirectAuthenticatedUser } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	if (IS_CLOUD) {
		await redirectAuthenticatedUser();
		return <ClientPage IS_CLOUD={IS_CLOUD} />;
	}

	const hasAdmin = await isAdminPresent();
	if (!hasAdmin) {
		redirect("/register");
	}

	await redirectAuthenticatedUser();
	return <ClientPage IS_CLOUD={IS_CLOUD} />;
}
