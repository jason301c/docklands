"use client";

import "./globals.css";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { createClientLogger } from "@/client/lib/logger";

const log = createClientLogger("global");

/**
 * Top-level boundary that replaces the root layout when an error escapes it, so
 * it must render its own `<html>`/`<body>`. Kept dependency-light (no providers)
 * because the very layer that would supply them is what failed.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		log.error("Global root error", error);
	}, [error]);

	return (
		<html lang="en" className="h-full font-sans" data-theme="kumo">
			<body className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-6 text-center font-sans">
				<div className="flex size-12 items-center justify-center rounded-full bg-kumo-danger-tint text-kumo-danger">
					<AlertTriangle className="size-6" />
				</div>
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">
						Docklands hit an unexpected error
					</h2>
					<p className="max-w-md text-sm text-kumo-subtle">
						{error.message ||
							"Something went wrong while rendering the application."}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={reset}
						className="h-9 rounded-lg bg-kumo-brand px-3 text-base text-white hover:bg-kumo-brand-hover"
					>
						Try again
					</button>
					<a
						href="/dashboard/workspace"
						className="h-9 rounded-lg bg-kumo-base px-3 py-2 text-base text-kumo-default ring ring-kumo-line hover:bg-kumo-tint"
					>
						Go to workspaces
					</a>
				</div>
			</body>
		</html>
	);
}
