import { redirect } from "next/navigation";
import ClientPage from "./_client";
import { IS_CLOUD } from "@/server/core/constants/env";
import { isAdminPresent } from "@/server/core/services/admin";
import { redirectAuthenticatedUser } from "@/server/web/app-auth";

export default async function Page() {
	if (IS_CLOUD) {
		await redirectAuthenticatedUser();
		return <ClientPage hasAdmin={false} isCloud={true} />;
	}

	const hasAdmin = await isAdminPresent();
	if (hasAdmin) {
		redirect("/");
	}

	return <ClientPage hasAdmin={false} isCloud={false} />;
}
