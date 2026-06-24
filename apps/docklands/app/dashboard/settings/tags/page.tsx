import { TagManager } from "@/components/dashboard/settings/tags/tag-manager";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("tag", "read", "/");
	return (
		<div className="flex flex-col gap-4 w-full">
			<TagManager />
		</div>
	);
}
