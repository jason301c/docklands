/**
 * Service-detail skeleton shown while a service page resolves. The service
 * surfaces (application/compose/database) all render a header plus a Tabs
 * strip over a content panel, so this mirrors that shape rather than the
 * canvas-shaped skeleton inherited from the environment route.
 */
export default function ServiceDetailLoading() {
	return (
		<div className="flex w-full flex-col gap-6 p-6">
			<div className="flex items-center gap-3">
				<div className="size-10 animate-pulse rounded-lg bg-kumo-tint" />
				<div className="flex flex-col gap-2">
					<div className="h-6 w-56 animate-pulse rounded-lg bg-kumo-tint" />
					<div className="h-4 w-40 animate-pulse rounded-lg bg-kumo-tint" />
				</div>
			</div>
			<div className="flex gap-2 border-b pb-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="h-7 w-24 animate-pulse rounded-lg bg-kumo-tint"
					/>
				))}
			</div>
			<div className="h-64 w-full animate-pulse rounded-lg border bg-kumo-tint" />
		</div>
	);
}
