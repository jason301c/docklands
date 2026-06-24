import { ShowStorageProviders } from "@/components/dashboard/settings/storage/show-storage-providers";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowStorageProviders />
		</div>
	);
}
