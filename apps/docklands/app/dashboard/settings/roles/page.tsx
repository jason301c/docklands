import { requireAdmin } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	// Every custom-role mutation is an `adminProcedure`, so gate the manager at
	// the same altitude (owner/admin). A `member:read` role no longer opens a UI
	// whose actions all fail server-side.
	await requireAdmin();
	return <ClientPage />;
}
