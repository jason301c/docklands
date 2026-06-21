import { redirect } from "next/navigation";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("docker", "read", "/");
	redirect("/dashboard/runtime");
}
