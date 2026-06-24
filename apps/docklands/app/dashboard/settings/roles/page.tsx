import { RoleManager } from "@/components/dashboard/settings/roles/role-manager";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	// Every custom-role mutation is an `adminProcedure`, so gate the manager at
	// the same altitude (owner/admin). A `member:read` role no longer opens a UI
	// whose actions all fail server-side.
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<RoleManager />
		</div>
	);
}
