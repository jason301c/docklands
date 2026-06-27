import type { Control, UseFormReturn } from "react-hook-form";
import type {
	NotificationFormInput,
	NotificationSchema,
} from "../notification-schema";

/**
 * Shared form types for the registry-driven notification provider fields. The
 * parent owns a single `react-hook-form` instance whose values are the
 * `notificationSchema` discriminated union across every provider, so the
 * `control`/`form` threaded into the field primitives are typed to that union
 * (which is why `name="botToken"`, `name="smtpServer"`, etc. all resolve).
 */

/** The `react-hook-form` control the notification form exposes. */
export type NotificationFormControl = Control<
	NotificationFormInput,
	unknown,
	NotificationSchema
>;

/** The full `react-hook-form` instance (needed for `watch` and error state). */
export type NotificationForm = UseFormReturn<
	NotificationFormInput,
	unknown,
	NotificationSchema
>;
