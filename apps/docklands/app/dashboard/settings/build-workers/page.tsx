import { requireSelfHostedAdmin } from "@/server/web/app-auth";
import ClientPage from "../deployments/_client";

export default async function Page() {
	await requireSelfHostedAdmin();
	return <ClientPage />;
}
