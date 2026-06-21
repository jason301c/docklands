import { redirect } from "next/navigation";
import ClientPage from "./_client";
import { IS_CLOUD } from "@/server/core/constants/env";
import { isAdminPresent } from "@/server/core/services/admin";
import { getWebServerSettings } from "@/server/core/services/web-server-settings";
import { redirectAuthenticatedUser } from "@/server/web/app-auth";

export default async function Page() {
	if (IS_CLOUD) {
		await redirectAuthenticatedUser();
		return <ClientPage IS_CLOUD={IS_CLOUD} enforceSSO={false} />;
	}

	const hasAdmin = await isAdminPresent();
	if (!hasAdmin) {
		redirect("/register");
	}

	await redirectAuthenticatedUser();
	const webServerSettings = await getWebServerSettings();

	return (
		<ClientPage
			IS_CLOUD={IS_CLOUD}
			enforceSSO={webServerSettings?.enforceSSO ?? false}
		/>
	);
}
