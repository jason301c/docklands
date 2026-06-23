// Cross-runtime DTO describing the result of a runtime-worker update check.
// Lives in `shared/` so client components (the update banner/dialog) and the
// backend settings service can both reference it without inverting the layering.
export interface IUpdateData {
	latestVersion: string | null;
	updateAvailable: boolean;
}
