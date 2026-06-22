"use client";

import { ShowRuntimeWorkers } from "@/components/dashboard/settings/runtime/show-runtime-workers";

const Page = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowRuntimeWorkers />
		</div>
	);
};

export default Page;
