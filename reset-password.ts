import { eq } from "drizzle-orm";
import { generateRandomPassword } from "@/server-core/auth/random-password";
import { findOwner } from "@/server-core/services/admin";
import { db } from "@/server-core/db";
import { account } from "@/server-core/db/schema";

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
			console.log("Password reset successful");
			console.log("New password: ", randomPassword.randomPassword);
		} else {
			console.log("Password reset failed");
		}

		process.exit(0);
	} catch (error) {
		console.log("Error resetting password", error);
	}
})();
