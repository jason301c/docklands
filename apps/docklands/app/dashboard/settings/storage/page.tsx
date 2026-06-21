import { requireAdmin } from "@/server/web/app-auth";
import ClientPage from "../destinations/_client";

export default async function Page() {
	await requireAdmin();
	return <ClientPage />;
}
