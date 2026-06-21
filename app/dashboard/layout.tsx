import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { requireUser } from "@/server/web/app-auth";

export default async function Layout({ children }: { children: ReactNode }) {
	await requireUser();

	return <DashboardLayout>{children}</DashboardLayout>;
}
