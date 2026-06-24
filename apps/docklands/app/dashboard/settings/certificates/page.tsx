import { ShowCertificates } from "@/components/dashboard/settings/certificates/show-certificates";
import { requireAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireAdmin();
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowCertificates />
		</div>
	);
}
