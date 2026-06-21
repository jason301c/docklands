import { requirePermission } from "@/server/web/app-auth";
import ClientPage from "../traefik/_client";

export default async function Page() {
	await requirePermission("traefikFiles", "read", "/");
	return <ClientPage />;
}
