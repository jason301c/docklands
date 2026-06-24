import { ShowImageRegistry } from "@/components/dashboard/settings/image-registry/show-image-registry";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowImageRegistry />
		</div>
	);
}
