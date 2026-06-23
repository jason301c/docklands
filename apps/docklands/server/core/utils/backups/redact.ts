/**
 * Redacts S3 credentials from rclone command strings.
 *
 * Used to prevent credential leakage in structured logs and error output.
 * Matches both the legacy flag format (`--s3-access-key-id="VALUE"`) and the
 * current env-prefix format produced by `getS3CredentialEnv()`
 * (`RCLONE_S3_ACCESS_KEY_ID='VALUE'`).
 */
export const redactRcloneCredentials = (command: string): string => {
	return command
		.replace(/(--s3-access-key-id=)"[^"]*"/g, '$1"[REDACTED]"')
		.replace(/(--s3-secret-access-key=)"[^"]*"/g, '$1"[REDACTED]"')
		.replace(/(RCLONE_S3_ACCESS_KEY_ID=)'[^']*'/g, "$1'[REDACTED]'")
		.replace(/(RCLONE_S3_SECRET_ACCESS_KEY=)'[^']*'/g, "$1'[REDACTED]'");
};
