import { EnvironmentCanvas } from "@/components/dashboard/workspace/environment-canvas";
import { requireUser } from "@/server/web/app-auth";

type PageProps = {
	params: Promise<{ workspaceId: string; environmentId: string }>;
};

export default async function Page({ params }: PageProps) {
	await requireUser();
	const { workspaceId, environmentId } = await params;
	return (
		<EnvironmentCanvas projectId={workspaceId} environmentId={environmentId} />
	);
}
