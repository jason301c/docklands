"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import "./globals.css";

/**
 * Last-resort boundary for crashes in the root layout itself. It replaces the
 * whole document, so it ships its own <html>/<body> and pulls in globals; no
 * site header/footer, since the layout that renders them is what failed.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<html lang="en" data-theme="kumo" className="h-full font-sans">
			<body className="flex min-h-full w-full flex-col font-sans antialiased">
				<ErrorState
					code="500"
					headline="The whole herd went over."
					message="Docklands hit an error it couldn't recover from. It's been logged — reload to try again."
					cowRotation={180}
				>
					<Button
						variant="primary"
						size="lg"
						icon={<ArrowClockwiseIcon weight="bold" />}
						onClick={() => reset()}
					>
						Reload
					</Button>
				</ErrorState>
			</body>
		</html>
	);
}
