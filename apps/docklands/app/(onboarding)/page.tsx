import { redirect } from "next/navigation";
import { isAdminPresent } from "@/server/core/services/admin";
import { redirectAuthenticatedUser } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	const hasAdmin = await isAdminPresent();
	if (!hasAdmin) {
		redirect("/register");
	}

	await redirectAuthenticatedUser();
	return <ClientPage />;
}
