import { ShowRuntimeWorkers } from "@/components/dashboard/settings/runtime/show-runtime-workers";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowRuntimeWorkers />
		</div>
	);
}
