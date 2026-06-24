import { ShowCloudflare } from "@/components/dashboard/settings/cloudflare/show-cloudflare";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("tunnel", "read", "/dashboard/workspace");
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowCloudflare />
		</div>
	);
}
