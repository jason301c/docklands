import { requirePermission, requireSelfHosted } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	requireSelfHosted();
	await requirePermission("monitoring", "read", "/dashboard/workspace");
	return <ClientPage />;
}
