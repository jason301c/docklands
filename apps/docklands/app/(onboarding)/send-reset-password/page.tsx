import { isSystemEmailConfigured } from "@/server/core/services/system-email";
import ClientPage from "./_client";

export default async function Page() {
	// Resolved server-side so the page can tell the user up front when password
	// reset by email isn't available. This is instance-level config, not
	// account-specific, so exposing it does not enable email enumeration.
	const emailConfigured = await isSystemEmailConfigured();
	return <ClientPage emailConfigured={emailConfigured} />;
}
