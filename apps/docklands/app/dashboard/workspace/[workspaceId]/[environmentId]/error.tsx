"use client";

import { useEffect } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { RouteError } from "@/components/shared/route-error";

const log = createClientLogger("environment-canvas");

export default function EnvironmentCanvasError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		log.error("Environment canvas route error", error);
	}, [error]);

	return (
		<RouteError
			error={error}
			reset={reset}
			title="This environment failed to load"
		/>
	);
}
