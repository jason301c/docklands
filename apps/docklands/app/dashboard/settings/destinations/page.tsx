import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	redirect("/dashboard/settings/storage");
}
