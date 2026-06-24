import { OnboardingSetup } from "@/components/dashboard/onboarding/onboarding-setup";
import { requirePermission } from "@/server/web/app-auth";

export default async function Page() {
	await requirePermission("organization", "update", "/dashboard/workspace");
	return (
		<div className="flex flex-col gap-4 w-full">
			<OnboardingSetup />
		</div>
	);
}
