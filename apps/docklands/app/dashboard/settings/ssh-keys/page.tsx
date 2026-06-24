import { ShowSshKeys } from "@/components/dashboard/settings/ssh-keys/show-ssh-keys";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("sshKeys", "read", "/");
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowSshKeys />
		</div>
	);
}
