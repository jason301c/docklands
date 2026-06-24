import { Input } from "@cloudflare/kumo/components/input";
import type { Control, FieldValues, Path } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import {
	type BackupDatabaseEngineKey,
	COMPOSE_BACKUP_METADATA_FIELDS,
	type ComposeBackupMetadataField,
} from "@/shared/database-engines";

/**
 * Renders the credential inputs a compose backup/restore needs for the selected
 * engine, driven by `COMPOSE_BACKUP_METADATA_FIELDS`. Both backup forms render
 * the same fields; only the input placeholders differ, so each form supplies a
 * `placeholder` resolver. Engines without compose credentials (none today) emit
 * nothing.
 */
export const ComposeCredentialFields = <TFieldValues extends FieldValues>({
	databaseType,
	control,
	placeholder,
}: {
	databaseType: string | undefined;
	control: Control<TFieldValues>;
	placeholder: (
		engine: BackupDatabaseEngineKey,
		field: ComposeBackupMetadataField,
	) => string;
}) => {
	const fields =
		COMPOSE_BACKUP_METADATA_FIELDS[databaseType as BackupDatabaseEngineKey];
	if (!fields) return null;
	const engine = databaseType as BackupDatabaseEngineKey;

	return (
		<>
			{fields.map((field) => (
				<FormField
					key={field.name}
					control={control}
					name={`metadata.${engine}.${field.name}` as Path<TFieldValues>}
					render={({ field: formField }) => (
						<FormItem>
							<FormLabel>{field.label}</FormLabel>
							<FormControl>
								<Input
									type={field.isPassword ? "password" : undefined}
									placeholder={placeholder(engine, field)}
									{...formField}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			))}
		</>
	);
};
