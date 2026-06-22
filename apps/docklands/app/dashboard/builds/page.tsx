import { requirePermission } from "@/server/web/app-auth";
import ClientPage from "../deployments/_client";

export default async function Page() {
	await requirePermission("deployment", "read", "/dashboard/workspace");
	return <ClientPage />;
}
