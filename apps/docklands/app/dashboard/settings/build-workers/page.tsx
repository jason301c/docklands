import { requireSelfHostedAdmin } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	await requireSelfHostedAdmin();
	return <ClientPage />;
}
