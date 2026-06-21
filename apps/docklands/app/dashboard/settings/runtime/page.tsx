import { requireAdmin } from "@/server/web/app-auth";
import ClientPage from "../servers/_client";

export default async function Page() {
	await requireAdmin();
	return <ClientPage />;
}
