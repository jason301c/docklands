import ClientPage from "./_client";
import { requireUser } from "@/server/web/app-auth";

type PageProps = {
	params: Promise<{ projectId: string; environmentId: string }>;
};

export default async function Page({ params }: PageProps) {
	await requireUser();
	const { projectId, environmentId } = await params;
	return <ClientPage projectId={projectId} environmentId={environmentId} />;
}
