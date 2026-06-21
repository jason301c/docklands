import ClientPage from "./_client";
import { requireUser } from "@/server/web/app-auth";

type PageProps = {
	params: Promise<{ projectId: string; environmentId: string; applicationId: string }>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
	await requireUser();
	const resolvedParams = await params;
	const resolvedSearchParams = await searchParams;
	const activeTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "general";

	return (
		<ClientPage
			projectId={resolvedParams.projectId}
			environmentId={resolvedParams.environmentId}
			applicationId={resolvedParams.applicationId}
			activeTab={activeTab as never}
		/>
	);
}
