import { requireUser } from "@/server/web/app-auth";
import ClientPage from "./_client";

type PageProps = {
	params: Promise<{
		projectId: string;
		environmentId: string;
		redisId: string;
	}>;
	searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function Page({ params, searchParams }: PageProps) {
	await requireUser();
	const resolvedParams = await params;
	const resolvedSearchParams = await searchParams;
	const activeTab =
		typeof resolvedSearchParams.tab === "string"
			? resolvedSearchParams.tab
			: "general";

	return (
		<ClientPage
			projectId={resolvedParams.projectId}
			environmentId={resolvedParams.environmentId}
			redisId={resolvedParams.redisId}
			activeTab={activeTab as never}
		/>
	);
}
