import { requireSelfHostedAdmin } from "@/server/web/app-auth";
import ClientPage from "../server/_client";

export default async function Page() {
	await requireSelfHostedAdmin();
	return <ClientPage />;
}
