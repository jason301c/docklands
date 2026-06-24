import { ShowAuditLog } from "@/components/dashboard/settings/audit-log/show-audit-log";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("auditLog", "read", "/");
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowAuditLog />
		</div>
	);
}
