import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const notificationRouterSource = () =>
	readFileSync(
		fileURLToPath(
			new URL("../../server/api/routers/notification.ts", import.meta.url),
		),
		"utf8",
	);

const sourceFile = (path: string) =>
	readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("notification public boundary", () => {
	it("does not expose the unfinished public monitoring notification endpoint", () => {
		const source = notificationRouterSource();

		expect(source).not.toContain("receiveNotification");
		expect(source).not.toContain("publicProcedure");
		expect(source).not.toContain("sendServerThresholdNotifications");
	});

	it("does not keep the removed host-threshold notification flag in active models", () => {
		const dbSchema = sourceFile("../../server/core/db/schema/notification.ts");
		const formSchema = sourceFile(
			"../../components/dashboard/settings/notifications/notification-schema.ts",
		);

		expect(dbSchema).not.toContain("serverThreshold");
		expect(formSchema).not.toContain("serverThreshold");
	});
});
