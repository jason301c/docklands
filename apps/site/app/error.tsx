"use client";

import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { ArrowClockwiseIcon, HouseIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Surface it in the console for debugging; the digest links to server logs.
		console.error(error);
	}, [error]);

	return (
		<>
			<SiteHeader />
			<main className="flex flex-1 flex-col">
				<ErrorState
					code="500"
					headline="The cow tipped over."
					message="Something on our end fell off the dock. The error's been logged — give it another go, and if it keeps mooing, the issue tracker is the place to yell."
					cowRotation={180}
				>
					<Button
						variant="primary"
						size="lg"
						icon={<ArrowClockwiseIcon weight="bold" />}
						onClick={() => reset()}
					>
						Try again
					</Button>
					<LinkButton
						href="/"
						variant="secondary"
						size="lg"
						icon={<HouseIcon weight="bold" />}
					>
						Back to home
					</LinkButton>
				</ErrorState>
			</main>
			<SiteFooter />
		</>
	);
}
