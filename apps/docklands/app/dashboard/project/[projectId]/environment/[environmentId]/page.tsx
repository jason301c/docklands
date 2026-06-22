import { redirect } from "next/navigation";
import { workspaceEnvironmentPath } from "@/shared/routes";

type PageProps = {
	params: Promise<{ projectId: string; environmentId: string }>;
};

export default async function Page({ params }: PageProps) {
	const { projectId, environmentId } = await params;
	redirect(workspaceEnvironmentPath({ projectId, environmentId }));
}
