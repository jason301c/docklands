import { redirect } from "next/navigation";
import { workspaceListView, workspaceOverviewPath } from "@/shared/routes";

type Props = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
	const params = new URLSearchParams();
	params.set("view", workspaceListView);

	const query = (await searchParams).q;
	if (typeof query === "string" && query.trim()) {
		params.set("q", query);
	}

	redirect(`${workspaceOverviewPath}?${params.toString()}`);
}
