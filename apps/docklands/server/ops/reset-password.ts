import { eq } from "drizzle-orm";
import { generateRandomPassword } from "@/server/core/auth/random-password";
import { db } from "@/server/core/db";
import { account } from "@/server/core/db/schema";
import { createLogger } from "@/server/core/lib/logger";
import { findOwner } from "@/server/core/services/admin";

const logger = createLogger("ops:reset-password");

(async () => {
	try {
		const randomPassword = await generateRandomPassword();

		const result = await findOwner();

		const update = await db
			.update(account)
			.set({
				password: randomPassword.hashedPassword,
			})
			.where(eq(account.userId, result.userId));

		if (update) {
			logger.info("Password reset successful");
			// Deliberate plain stdout — the operator runs this script to obtain the
			// new credential. Do NOT route through structured logger.
			console.log("New password: ", randomPassword.randomPassword);
		} else {
			logger.warn(
				"Password reset returned no-op — check owner account record exists",
			);
		}

		process.exit(0);
	} catch (error) {
		logger.error({ err: error }, "Error resetting password");
		process.exit(1);
	}
})();
