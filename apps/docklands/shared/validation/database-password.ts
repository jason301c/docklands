// Allowed character set for managed-database passwords. These passwords are
// interpolated into change-password / dump shell commands (inside both single-
// and double-quoted contexts), so shell-dangerous characters are excluded:
// `$ ! ' " \ / ` ` (backtick) and whitespace — backtick in particular would
// trigger command substitution inside a double-quoted `psql -c "..."`.
//
// This is the single source of truth shared by the server validators
// (server/core/db/schema/utils.ts re-exports it) and the password UI form, so
// the two can't drift (the form previously allowed a backtick the server
// rejected).
export const DATABASE_PASSWORD_REGEX =
	/^[a-zA-Z0-9@#%^&*()_+\-=[\]{}|;:,.<>?~]*$/;

export const DATABASE_PASSWORD_MESSAGE =
	"Password contains invalid characters. Please avoid: $ ! ' \" \\ / ` and space characters for database compatibility";
