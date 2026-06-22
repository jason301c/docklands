import { redirect } from "next/navigation";
import { workspaceServicePath } from "@/shared/routes";

type PageProps = {
	params: Promise<{
		projectId: string;
		environmentId: string;
		libsqlId: string;
	}>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
	const resolvedParams = await params;
	const resolvedSearchParams = await searchParams;
	const activeTab =
		typeof resolvedSearchParams.tab === "string"
			? resolvedSearchParams.tab
			: null;

	redirect(
		workspaceServicePath({
			projectId: resolvedParams.projectId,
			environmentId: resolvedParams.environmentId,
			serviceType: "libsql",
			serviceId: resolvedParams.libsqlId,
			tab: activeTab,
		}),
	);
}
