import { requireUser } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	// Any authenticated member; the Requests and Files tabs gate themselves and
	// their tRPC queries enforce access server-side.
	await requireUser();
	return <ClientPage />;
}
