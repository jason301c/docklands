/**
 * Content-area skeleton shown during dashboard navigation. The sidebar shell
 * lives in `dashboard/layout.tsx` and stays mounted, so this fills only the
 * content slot and prevents the previous route from freezing while the next
 * server render + client mount resolve.
 */
export default function DashboardLoading() {
	return (
		<div className="flex w-full flex-col gap-6 p-6">
			<div className="h-8 w-48 animate-pulse rounded-lg bg-kumo-tint" />
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="h-28 animate-pulse rounded-lg border bg-kumo-tint"
					/>
				))}
			</div>
		</div>
	);
}
