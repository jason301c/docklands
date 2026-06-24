"use client";

import { FolderIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Showcase gallery as a row of folders: each feature is a folder tab, and the
 * selected one is "open", revealing its screenshot. The folders auto-rotate
 * every ROTATE_MS, but the first interaction (any tab click) turns autoplay off
 * for the rest of the page's life - we never wrestle the pointer back.
 *
 * The screenshots themselves are intentionally blank white panels for now, with
 * a loading shimmer over them. Drop real captures in by replacing the
 * `<div … bg-white />` placeholder (or swapping in an <Image />) once they exist.
 */

const ROTATE_MS = 10000;

type Folder = {
	id: string;
	label: string;
	caption: string;
};

const FOLDERS: Folder[] = [
	{
		id: "workspace",
		label: "Workspace",
		caption: "Project workspace canvas",
	},
	{
		id: "deployments",
		label: "Deployments",
		caption: "Deployments and build queue",
	},
	{
		id: "metrics",
		label: "Metrics",
		caption: "Live host and service metrics",
	},
	{
		id: "databases",
		label: "Databases",
		caption: "Managed database services",
	},
];

export function ScreenshotGallery() {
	const [activeId, setActiveId] = useState(FOLDERS[0].id);
	const [autoplay, setAutoplay] = useState(true);
	const active = FOLDERS.find((f) => f.id === activeId) ?? FOLDERS[0];

	useEffect(() => {
		if (!autoplay) return;
		const id = setInterval(() => {
			setActiveId((current) => {
				const index = FOLDERS.findIndex((f) => f.id === current);
				return FOLDERS[(index + 1) % FOLDERS.length].id;
			});
		}, ROTATE_MS);
		return () => clearInterval(id);
	}, [autoplay]);

	// Any manual pick permanently stops autoplay (until a page refresh).
	const handleSelect = (id: string) => {
		setAutoplay(false);
		setActiveId(id);
	};

	return (
		<section
			id="showcase"
			className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 pt-24"
		>
			<div className="reveal-up max-w-2xl">
				<h2 className="font-display font-semibold text-3xl text-kumo-strong tracking-tight sm:text-4xl">
					See Docklands in action
				</h2>
				<p className="mt-4 text-kumo-subtle text-lg leading-relaxed">
					The project canvas, deployments, and live metrics, in one place you
					control.
				</p>
			</div>

			<div className="reveal-up mt-12">
				{/* Folder tabs stacked horizontally; the active one reads as "open". */}
				<div className="flex gap-1.5 overflow-x-auto pb-px">
					{FOLDERS.map((folder) => {
						const isActive = folder.id === activeId;
						const Glyph = isActive ? FolderOpenIcon : FolderIcon;
						return (
							<button
								key={folder.id}
								type="button"
								onClick={() => handleSelect(folder.id)}
								className={cn(
									"flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-4 pt-2.5 pb-3 font-medium text-sm transition-colors",
									isActive
										? "-mb-px z-10 border-kumo-hairline bg-kumo-base text-kumo-strong"
										: "translate-y-1 border-transparent bg-kumo-recessed text-kumo-subtle hover:text-kumo-default",
								)}
							>
								<Glyph
									size={16}
									weight={isActive ? "fill" : "regular"}
									className={isActive ? "text-kumo-brand" : ""}
								/>
								{folder.label}
							</button>
						);
					})}
				</div>

				{/* The open folder, lifted off a brand glow that wraps every edge. */}
				<div className="relative">
					<div
						aria-hidden
						className="-z-10 -inset-6 animate-gradient-pan pointer-events-none absolute opacity-25 blur-2xl sm:-inset-10"
						style={{ backgroundImage: "var(--gradient-brand)" }}
					/>

					<div className="relative overflow-hidden rounded-xl rounded-tl-none border border-kumo-hairline bg-kumo-base">
						{/* Terminal-style window chrome, no address bar. */}
						<div className="flex items-center gap-1.5 border-kumo-hairline border-b bg-kumo-recessed px-4 py-3">
							<span className="size-2.5 rounded-full bg-kumo-line" />
							<span className="size-2.5 rounded-full bg-kumo-line" />
							<span className="size-2.5 rounded-full bg-kumo-line" />
						</div>

						{/* Blank screenshot placeholder with a loading shimmer, plus the
						 * auto-rotate timer sitting just under the chrome. */}
						<div className="relative aspect-[16/9] overflow-hidden bg-white">
							{autoplay && (
								<span
									key={activeId}
									aria-hidden
									className="absolute top-0 left-0 z-10 h-0.5 animate-gallery-progress bg-kumo-brand"
								/>
							)}
							<span
								aria-hidden
								className="absolute inset-0 animate-gallery-shimmer"
								style={{
									background:
										"linear-gradient(90deg, transparent, rgba(15, 15, 20, 0.06), transparent)",
								}}
							/>
						</div>
					</div>
				</div>

				<p className="mt-3 text-kumo-subtle text-sm">{active.caption}</p>
			</div>
		</section>
	);
}
