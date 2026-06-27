import { requireUser } from "@/server/web/app-auth";
import ClientPage from "./_client";

export default async function Page() {
	// Any authenticated member; individual tabs gate themselves on the relevant
	// permission (docker / monitoring) and the underlying tRPC queries enforce
	// access server-side.
	await requireUser();
	return <ClientPage />;
}
