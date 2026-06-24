"use client";

import { useEffect } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { RouteError } from "@/components/shared/route-error";

const log = createClientLogger("service-detail");

export default function ServiceDetailError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		log.error("Service detail route error", error);
	}, [error]);

	return (
		<RouteError
			error={error}
			reset={reset}
			title="This service failed to load"
		/>
	);
}
