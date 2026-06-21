"use client";

import { ShowGitProviders } from "@/components/dashboard/settings/git/show-git-providers";

const Page = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowGitProviders />
		</div>
	);
};

export default Page;
