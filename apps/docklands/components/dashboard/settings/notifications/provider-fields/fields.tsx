import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import { PlusIcon, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { type FieldPath, useFieldArray } from "react-hook-form";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { NotificationFormInput } from "../notification-schema";
import type { NotificationForm, NotificationFormControl } from "./types";

/**
 * Shared, registry-driven field primitives for the notification provider forms.
 *
 * Every provider's connection form is a list of these primitives described by
 * the field registry (`field-config.tsx`); this is the "registry over
 * per-variant duplication" rule applied to notifications, replacing the twelve
 * near-identical per-provider field-set files that used to live here. Add a
 * provider by adding a registry entry, not a new component.
 */

/** Any valid field path on the notification form (the discriminated union). */
export type FieldName = FieldPath<NotificationFormInput>;

interface TextFieldProps {
	control: NotificationFormControl;
	name: FieldName;
	label: string;
	placeholder?: string;
	description?: string;
	/** Render as a masked password input. */
	password?: boolean;
	className?: string;
}

/** Single-line text (or password) input — the common case for most fields. */
export const TextField = ({
	control,
	name,
	label,
	placeholder,
	description,
	password,
	className,
}: TextFieldProps) => (
	<FormField
		control={control}
		name={name}
		render={({ field }) => (
			<FormItem className={className}>
				<FormLabel>{label}</FormLabel>
				<FormControl>
					<Input
						type={password ? "password" : "text"}
						placeholder={placeholder}
						{...field}
						value={(field.value as string | undefined) ?? ""}
					/>
				</FormControl>
				{description ? <FormDescription>{description}</FormDescription> : null}
				<FormMessage />
			</FormItem>
		)}
	/>
);

interface NumberFieldProps {
	control: NotificationFormControl;
	name: FieldName;
	label: string;
	placeholder?: string;
	description?: string;
	min?: number;
	max?: number;
	/** Initial value applied to the field and shown when empty. */
	defaultValue?: number;
	/** Value committed when the input is cleared (defaults to `undefined`). */
	emptyValue?: number;
	className?: string;
}

/** Numeric input with shared clamp-on-change + empty handling. */
export const NumberField = ({
	control,
	name,
	label,
	placeholder,
	description,
	min,
	max,
	defaultValue,
	emptyValue,
	className,
}: NumberFieldProps) => (
	<FormField
		control={control}
		name={name}
		defaultValue={defaultValue as never}
		render={({ field }) => (
			<FormItem className={className ?? "w-full"}>
				<FormLabel>{label}</FormLabel>
				<FormControl>
					<Input
						type="number"
						placeholder={placeholder}
						min={min}
						max={max}
						value={(field.value as number | undefined) ?? defaultValue ?? ""}
						onChange={(e) => {
							const raw = e.target.value;
							if (raw === "" || raw === "-") {
								field.onChange(emptyValue);
								return;
							}
							const parsed = Number.parseInt(raw, 10);
							if (Number.isNaN(parsed)) return;
							if (min !== undefined && parsed < min) return;
							if (max !== undefined && parsed > max) return;
							field.onChange(parsed);
						}}
					/>
				</FormControl>
				{description ? <FormDescription>{description}</FormDescription> : null}
				<FormMessage />
			</FormItem>
		)}
	/>
);

interface SwitchFieldProps {
	control: NotificationFormControl;
	name: FieldName;
	label: string;
	description?: string;
	defaultValue?: boolean;
}

/** Bordered toggle row (label + description on the left, switch on the right). */
export const SwitchField = ({
	control,
	name,
	label,
	description,
	defaultValue,
}: SwitchFieldProps) => (
	<FormField
		control={control}
		name={name}
		defaultValue={defaultValue as never}
		render={({ field }) => (
			<FormItem className="flex flex-row items-center justify-between gap-2 rounded-lg border border-kumo-line p-3 shadow-sm">
				<div className="space-y-0.5">
					<FormLabel>{label}</FormLabel>
					{description ? (
						<FormDescription>{description}</FormDescription>
					) : null}
				</div>
				<FormControl>
					<Switch checked={!!field.value} onCheckedChange={field.onChange} />
				</FormControl>
			</FormItem>
		)}
	/>
);

/** A trailing icon button that removes a row from a repeatable field. */
const RemoveRowButton = ({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) => (
	<Button
		type="button"
		variant="ghost"
		shape="square"
		aria-label={label}
		onClick={onClick}
		className="shrink-0 text-kumo-danger hover:bg-kumo-danger-tint hover:text-kumo-danger"
	>
		<Trash2 className="h-4 w-4" />
	</Button>
);

interface EmailListFieldProps {
	control: NotificationFormControl;
	form: NotificationForm;
}

/**
 * The `toAddresses` repeatable list shared by the email and resend providers.
 * Owns its own field array (and guarantees at least one row), so providers only
 * declare `{ kind: "emailList" }` in the registry.
 */
export const EmailListField = ({ control, form }: EmailListFieldProps) => {
	const { fields, append, remove } = useFieldArray({
		control: control as never,
		name: "toAddresses" as never,
	});

	useEffect(() => {
		if (fields.length === 0) append("" as never);
	}, [fields.length, append]);

	const rootError = (
		form.formState.errors as { toAddresses?: { root?: { message?: string } } }
	)?.toAddresses?.root?.message;

	return (
		<div className="flex flex-col gap-2 pt-2">
			<FormLabel>To Addresses</FormLabel>

			{fields.map((entry, index) => (
				<div key={entry.id} className="flex w-full flex-row items-start gap-2">
					<FormField
						control={control}
						name={`toAddresses.${index}` as FieldName}
						render={({ field }) => (
							<FormItem className="w-full">
								<FormControl>
									<Input
										placeholder="email@example.com"
										className="w-full"
										{...field}
										value={(field.value as string | undefined) ?? ""}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<RemoveRowButton
						label="Remove address"
						onClick={() => remove(index)}
					/>
				</div>
			))}

			{rootError ? (
				<div className="text-sm font-medium text-kumo-danger">{rootError}</div>
			) : null}

			<Button
				variant="primary"
				type="button"
				className="self-start"
				onClick={() => append("" as never)}
			>
				<PlusIcon className="h-4 w-4" />
				Add address
			</Button>
		</div>
	);
};

interface HeadersFieldProps {
	control: NotificationFormControl;
}

/** The key/value header list used by the custom-webhook provider. */
export const HeadersField = ({ control }: HeadersFieldProps) => {
	const { fields, append, remove } = useFieldArray({
		control: control as never,
		name: "headers" as never,
	});

	return (
		<div className="space-y-3">
			<div>
				<FormLabel>Headers</FormLabel>
				<FormDescription>
					Optional. Custom headers for your POST request (e.g., Authorization,
					Content-Type).
				</FormDescription>
			</div>

			<div className="space-y-2">
				{fields.map((entry, index) => (
					<div
						key={entry.id}
						className="flex items-center gap-2 rounded-md border border-kumo-line bg-kumo-fill/50 p-2"
					>
						<FormField
							control={control}
							name={`headers.${index}.key` as FieldName}
							render={({ field }) => (
								<FormItem className="flex-1">
									<FormControl>
										<Input
											placeholder="Key"
											{...field}
											value={(field.value as string | undefined) ?? ""}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name={`headers.${index}.value` as FieldName}
							render={({ field }) => (
								<FormItem className="flex-[2]">
									<FormControl>
										<Input
											placeholder="Value"
											{...field}
											value={(field.value as string | undefined) ?? ""}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
						<RemoveRowButton
							label="Remove header"
							onClick={() => remove(index)}
						/>
					</div>
				))}
			</div>

			<Button
				type="button"
				variant="primary"
				className="self-start"
				onClick={() => append({ key: "", value: "" } as never)}
			>
				<PlusIcon className="h-4 w-4" />
				Add header
			</Button>
		</div>
	);
};
