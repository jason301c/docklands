"use client";

import { ShowAuditLog } from "@/components/dashboard/settings/audit-log/show-audit-log";

const Page = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowAuditLog />
		</div>
	);
};

export default Page;
