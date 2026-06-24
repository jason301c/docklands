import { z } from "zod";

/**
 * Validators for identifier fields that get interpolated into shell commands
 * (docker volume/service names, S3 buckets and key prefixes). These run at the
 * tRPC/Zod boundary so the values can never carry shell metacharacters by the
 * time a backup/restore/deploy command is assembled — a defense that complements
 * the `shell-quote` escaping done at each command-build site.
 *
 * The charsets are deliberately a subset of what each system actually allows: a
 * Docker object name or S3 bucket can never legitimately contain `;`, `|`, `$`,
 * backticks, quotes, spaces, etc., so rejecting them costs nothing real.
 */

// Docker object names (volumes, services): start alphanumeric, then
// alphanumeric plus `_ . -`. Matches Docker's own naming rules.
export const DOCKER_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

// S3 bucket names: alphanumeric plus `. -`.
export const S3_BUCKET_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

// S3 key prefix: alphanumeric plus `. _ - /`. May be empty (no prefix).
export const S3_PREFIX_REGEX = /^[a-zA-Z0-9._/-]*$/;

export const dockerNameField = z
	.string()
	.min(1)
	.regex(DOCKER_NAME_REGEX, "Only letters, numbers, and ._- are allowed");

export const s3BucketField = z
	.string()
	.min(1)
	.regex(S3_BUCKET_REGEX, "Only letters, numbers, and .- are allowed");

export const s3PrefixField = z
	.string()
	.regex(S3_PREFIX_REGEX, "Only letters, numbers, and ._-/ are allowed");
