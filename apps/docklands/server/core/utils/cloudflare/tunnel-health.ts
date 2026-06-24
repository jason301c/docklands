import { scheduleJob } from "node-schedule";
import { createLogger } from "@/server/core/lib/logger";
import { checkTunnelHealth } from "@/server/core/services/tunnel";

const logger = createLogger("tunnel-health");

// Every 2 minutes. Cheap (one docker inspect per tunnel) and the status only
// needs to be roughly current for the settings UI.
const TUNNEL_HEALTH_CRON = "*/2 * * * *";

/**
 * Periodically refresh each tunnel's stored `status` so the Cloudflare settings
 * surface reflects whether the managed cloudflared is actually running, instead
 * of the column sitting at "unknown" forever.
 */
export const initTunnelHealthCron = () => {
	logger.info("Setting up Cloudflare tunnel health cron job");
	// Refresh once at startup so status isn't stale until the first tick.
	void checkTunnelHealth().catch((err) =>
		logger.error({ err }, "Initial tunnel health check failed"),
	);
	scheduleJob("tunnel-health", TUNNEL_HEALTH_CRON, async () => {
		try {
			await checkTunnelHealth();
		} catch (err) {
			logger.error({ err }, "Tunnel health cron failed");
		}
	});
};
