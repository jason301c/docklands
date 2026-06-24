import { ShowNotifications } from "@/components/dashboard/settings/notifications/show-notifications";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowNotifications />
		</div>
	);
}
