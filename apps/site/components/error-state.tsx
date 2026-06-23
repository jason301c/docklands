import type { ReactNode } from "react";

interface Props {
	/** Status code, rendered as the display-font h1 (e.g. "404", "500"). */
	code: string;
	/** Short, punchy line shown under the code. */
	headline: string;
	/** One or two sentences of friendlier explanation. */
	message: string;
	/** Degrees to rotate the cow. Docklands' "Cow Up a Tree" is upended, so are we. */
	cowRotation?: number;
	/** Action buttons (home / docs / retry). */
	children?: ReactNode;
}

/**
 * Shared empty/error state for the site's 404 and 500 pages. The mascot is a
 * tipped-over cow emoji — a nod to John Kelly's "Cow Up a Tree" sculpture that
 * actually lives in Docklands. No hooks here, so both the server `not-found`
 * page and the client `error` boundary can render it.
 */
export function ErrorState({
	code,
	headline,
	message,
	cowRotation = 135,
	children,
}: Props) {
	return (
		<section className="relative flex flex-1 items-center overflow-hidden">
			{/* Soft brand glow, matching the hero. */}
			<div
				aria-hidden
				className="-z-10 pointer-events-none absolute inset-x-0 top-[-8rem] mx-auto h-[22rem] max-w-3xl rounded-full bg-kumo-brand/10 blur-3xl"
			/>

			<div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-24 text-center">
				<span
					aria-hidden
					className="mb-2 inline-block select-none text-7xl leading-none sm:text-8xl"
					style={{ transform: `rotate(${cowRotation}deg)` }}
				>
					🐄
				</span>

				<h1 className="mt-6 font-display font-semibold text-7xl text-kumo-strong leading-none tracking-tight sm:text-8xl">
					{code}
				</h1>

				<p className="mt-4 text-balance font-medium text-kumo-strong text-xl tracking-tight sm:text-2xl">
					{headline}
				</p>

				<p className="mt-4 max-w-md text-pretty text-base text-kumo-subtle leading-relaxed">
					{message}
				</p>

				<div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
					{children}
				</div>
			</div>
		</section>
	);
}
