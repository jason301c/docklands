"use client";

import { api } from "@/client/api/trpc";
import { ImpersonationBar } from "../dashboard/impersonation/impersonation-bar";
import Page from "./side";

interface Props {
	children: React.ReactNode;
	metaName?: string;
}

export const DashboardLayout = ({ children }: Props) => {
	const { data: haveRootAccess } = api.user.haveRootAccess.useQuery();

	return (
		<>
			<Page>{children}</Page>
			{haveRootAccess === true && <ImpersonationBar />}
		</>
	);
};
