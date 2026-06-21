import ClientPage from "./_client";
import { requireSelfHostedAdmin } from "@/server/web/app-auth";

export default async function Page() {
	await requireSelfHostedAdmin();
	return <ClientPage />;
}
