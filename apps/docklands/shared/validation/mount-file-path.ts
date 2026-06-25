import { z } from "zod";

export const FILE_MOUNT_PATH_ERROR =
	"File mount paths must be relative paths under the service files directory and cannot contain traversal, empty segments, control characters, backslashes, or shell metacharacters";

const SHELL_META = new Set([
	'"',
	"'",
	"`",
	"$",
	";",
	"&",
	"|",
	"<",
	">",
	"(",
	")",
	"{",
	"}",
	"[",
	"]",
	"*",
	"?",
	"!",
]);

const hasControlWhitespaceOrShellMeta = (value: string) => {
	for (const char of value) {
		const code = char.charCodeAt(0);
		if (code <= 0x20 || code === 0x7f || SHELL_META.has(char)) {
			return true;
		}
	}

	return false;
};

export const isSafeRelativeFileMountPath = (value: string) => {
	if (!value || value.length > 512) {
		return false;
	}
	if (
		value.startsWith("/") ||
		value.startsWith("\\") ||
		/^[a-zA-Z]:[\\/]/.test(value)
	) {
		return false;
	}
	if (value.includes("\\") || value.includes("//")) {
		return false;
	}
	if (hasControlWhitespaceOrShellMeta(value)) {
		return false;
	}

	const pathWithoutTrailingSlash = value.endsWith("/")
		? value.slice(0, -1)
		: value;
	if (!pathWithoutTrailingSlash) {
		return false;
	}

	return pathWithoutTrailingSlash
		.split("/")
		.every((segment) => segment && segment !== "." && segment !== "..");
};

export const fileMountPathField = z
	.string()
	.min(1)
	.max(512)
	.refine(isSafeRelativeFileMountPath, FILE_MOUNT_PATH_ERROR);
