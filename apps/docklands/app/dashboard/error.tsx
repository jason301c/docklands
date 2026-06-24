"use client";

import { useEffect } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { RouteError } from "@/components/shared/route-error";

const log = createClientLogger("dashboard");

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		log.error("Dashboard route error", error);
	}, [error]);

	return <RouteError error={error} reset={reset} />;
}
