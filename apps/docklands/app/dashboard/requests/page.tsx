import { requireSelfHosted } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default function Page() {
	requireSelfHosted();
	return <ClientPage />;
}
