import ClientPage from "./_client";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("traefikFiles", "read", "/");
	return <ClientPage />;
}
