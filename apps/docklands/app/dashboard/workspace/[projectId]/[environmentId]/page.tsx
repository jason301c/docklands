import { EnvironmentCanvas } from "@/components/dashboard/workspace/environment-canvas";
import { requireUser } from "@/server/web/app-auth";

type PageProps = {
	params: Promise<{ projectId: string; environmentId: string }>;
};

export default async function Page({ params }: PageProps) {
	await requireUser();
	const { projectId, environmentId } = await params;
	return (
		<EnvironmentCanvas projectId={projectId} environmentId={environmentId} />
	);
}
