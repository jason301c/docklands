import { requirePermission } from "@/server/web/app-auth";
import ClientPage from "../docker/_client";

export default async function Page() {
	await requirePermission("docker", "read", "/");
	return <ClientPage />;
}
