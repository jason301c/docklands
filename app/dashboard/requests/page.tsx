import ClientPage from "./_client";
import { requireSelfHosted } from "@/server/web/app-auth";

export default function Page() {
	requireSelfHosted();
	return <ClientPage />;
}
