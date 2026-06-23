import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { user } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { findOwner } from "@/server/core/services/admin";

const logger = createLogger("ops:reset-2fa");

(async () => {
	try {
		const result = await findOwner();

		const update = await db
			.update(user)
			.set({
				twoFactorEnabled: false,
			})
			.where(eq(user.id, result.userId));

		if (update) {
			logger.info("2FA reset successful");
		} else {
			logger.warn("2FA reset returned no-op — check owner record exists");
		}

		process.exit(0);
	} catch (error) {
		logger.error({ err: error }, "Error resetting 2FA");
		process.exit(1);
	}
})();
