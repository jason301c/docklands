import { ShowRequests } from "@/components/dashboard/requests/show-requests";
import { requireSelfHosted } from "@/server/web/app-auth";

export default function Page() {
	requireSelfHosted();
	return <ShowRequests />;
}
