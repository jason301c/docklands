/**
 * Canvas-shaped skeleton shown while an environment's server render resolves —
 * a toolbar bar plus a scatter of node placeholders, so navigation into a
 * heavy canvas shows immediate structure instead of a frozen previous route.
 */
export default function EnvironmentCanvasLoading() {
	return (
		<div className="flex h-full w-full flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<div className="h-8 w-56 animate-pulse rounded-lg bg-kumo-tint" />
				<div className="h-8 w-40 animate-pulse rounded-lg bg-kumo-tint" />
			</div>
			<div className="relative flex-1 overflow-hidden rounded-lg border bg-kumo-canvas">
				<div className="grid grid-cols-2 gap-6 p-8 md:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							key={i}
							className="h-24 animate-pulse rounded-lg border bg-kumo-tint"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
