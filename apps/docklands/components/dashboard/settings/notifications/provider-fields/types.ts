import type { Control, UseFieldArrayReturn } from "react-hook-form";
import type {
	NotificationFormInput,
	NotificationSchema,
} from "../notification-schema";

/**
 * Shared prop types for the per-provider notification field-sets extracted from
 * `handle-notifications.tsx`. The parent owns a single `react-hook-form`
 * instance whose values are the `notificationSchema` discriminated union across
 * every provider, so the `control` it threads into each field-set is typed to
 * that union (every provider's field path is a member of the union, which is
 * why `name="botToken"`, `name="smtpServer"`, etc. all resolve). Each component
 * renders the exact FormFields/markup its provider branch rendered inline
 * before.
 */

/** The `react-hook-form` control the notification form exposes. */
export type NotificationFormControl = Control<
	NotificationFormInput,
	unknown,
	NotificationSchema
>;

/** Props for the provider field-sets that only need the form `control`. */
export interface ProviderFieldsProps {
	control: NotificationFormControl;
}

/** The `toAddresses` field-array shared by the email and resend field-sets. */
export type ToAddressesFieldArray = UseFieldArrayReturn<any, never, "id">;

/** The custom-headers field-array used by the custom field-set. */
export type HeadersFieldArray = UseFieldArrayReturn<any, never, "id">;
