import { ShowGitProviders } from "@/components/dashboard/settings/git/show-git-providers";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("gitProviders", "read", "/");
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowGitProviders />
		</div>
	);
}
