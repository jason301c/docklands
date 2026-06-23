import { redirect } from "next/navigation";
import { isAdminPresent } from "@/server/core/services/admin";
import ClientPage from "./_client";

export default async function Page() {
	const hasAdmin = await isAdminPresent();
	if (hasAdmin) {
		redirect("/");
	}

	return <ClientPage hasAdmin={false} />;
}
