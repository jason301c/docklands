import type { ReactNode } from "react";
import { AlertBlock } from "@/components/shared/alert-block";

interface EnterpriseFeatureLockedProps {
	title?: string;
	description?: string;
	ctaLabel?: string;
	compact?: boolean;
}

export function EnterpriseFeatureLocked({
	title = "Feature unavailable",
	description = "This feature is not included in Docklands.",
}: EnterpriseFeatureLockedProps) {
	return (
		<AlertBlock type="warning">
			<div className="flex flex-col gap-1">
				<span className="font-medium">{title}</span>
				<span className="text-sm">{description}</span>
			</div>
		</AlertBlock>
	);
}

export function EnterpriseFeatureGate({
	lockedProps,
}: {
	children: ReactNode;
	lockedProps?: Omit<EnterpriseFeatureLockedProps, "compact">;
}) {
	return <EnterpriseFeatureLocked {...lockedProps} />;
}
