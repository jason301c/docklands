import ClientPage from "./_client";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return <ClientPage />;
}
