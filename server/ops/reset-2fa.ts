import { eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import { user } from "@/server/core/db/schema";
import { findOwner } from "@/server/core/services/admin";

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
			console.log("2FA reset successful");
		} else {
			console.log("Password reset failed");
		}

		process.exit(0);
	} catch (error) {
		console.log("Error resetting 2FA", error);
	}
})();
