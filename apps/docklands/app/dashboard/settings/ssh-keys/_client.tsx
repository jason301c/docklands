"use client";

import { ShowSshKeys } from "@/components/dashboard/settings/ssh-keys/show-ssh-keys";

const Page = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowSshKeys />
		</div>
	);
};

export default Page;
