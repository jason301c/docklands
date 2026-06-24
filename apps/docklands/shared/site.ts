/**
 * Single source of truth for Docklands brand identity and outbound links in the
 * control-plane app. This mirrors `apps/site/lib/site.ts`; the workspace rule
 * forbids one app importing another app's source, so the two copies are kept in
 * sync by hand. Rebranding or moving the GitHub org is a single edit here —
 * `shared/routes.ts` and the server/email/OpenAPI consumers all derive from it.
 */

/** `owner/repo` slug shared by the GitHub repo, raw asset host, and image name. */
const GITHUB_SLUG = "jason301c/docklands";

/** Branch the email logo assets are served from (raw.githubusercontent.com). */
const ASSET_BRANCH = "canary";

const RAW_ASSET_BASE = `https://raw.githubusercontent.com/${GITHUB_SLUG}/refs/heads/${ASSET_BRANCH}/apps/docklands/public`;

export const siteConfig = {
	name: "Docklands",
	/** Public marketing/site origin. */
	url: "https://docklands.sh",
	links: {
		github: `https://github.com/${GITHUB_SLUG}`,
		docs: "https://docs.docklands.sh",
	},
	/** Published container image used for self-update checks (env-overridable). */
	dockerImage: GITHUB_SLUG,
	dockerHubTagsUrl: `https://hub.docker.com/v2/repositories/${GITHUB_SLUG}/tags`,
	/** Absolute logo URLs — email clients require fully-qualified asset hosts. */
	assets: {
		logoLight: `${RAW_ASSET_BASE}/docklands-logo-light.svg`,
		logoDark: `${RAW_ASSET_BASE}/docklands-logo-dark.svg`,
	},
} as const;
