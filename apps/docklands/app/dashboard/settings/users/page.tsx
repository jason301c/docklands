import { requirePermission } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	await requirePermission("member", "read", "/");
	return <ClientPage />;
}
