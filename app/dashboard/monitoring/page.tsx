import ClientPage from "./_client";
import { requirePermission, requireSelfHosted } from "@/server/web/app-auth";

export default async function Page() {
	requireSelfHosted();
	await requirePermission("monitoring", "read", "/dashboard/home");
	return <ClientPage />;
}
