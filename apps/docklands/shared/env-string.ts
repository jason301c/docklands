export type EnvEntry = {
	key: string;
	value: string;
};

const envKeyRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parseEnvironmentVariables = (
	input: string | null | undefined,
): EnvEntry[] => {
	const entries: EnvEntry[] = [];

	for (const rawLine of (input ?? "").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const normalizedLine = line.startsWith("export ")
			? line.slice("export ".length).trimStart()
			: line;
		const separatorIndex = normalizedLine.indexOf("=");
		if (separatorIndex <= 0) continue;

		const key = normalizedLine.slice(0, separatorIndex).trim();
		if (!envKeyRegex.test(key)) continue;

		entries.push({
			key,
			value: normalizedLine.slice(separatorIndex + 1),
		});
	}

	return entries;
};

/**
 * Remove the given keys from an env string (used to retract connection-variable
 * bindings when a connection is removed). Keeps every other line intact.
 */
export const removeEnvironmentVariables = (
	input: string | null | undefined,
	keys: string[],
) => {
	if (keys.length === 0) return (input ?? "").trim();
	const remove = new Set(keys);
	const kept = (input ?? "").split(/\r?\n/).filter((line) => {
		const entries = parseEnvironmentVariables(line);
		const key = entries[0]?.key;
		// Drop only well-formed `KEY=...` lines whose key is being retracted;
		// blank lines / comments / malformed lines are preserved.
		return !(key && remove.has(key));
	});
	return kept.join("\n").trim();
};

export const upsertEnvironmentVariables = (
	input: string | null | undefined,
	entries: EnvEntry[],
) => {
	const lines = (input ?? "").split(/\r?\n/);
	const nextLines = lines.filter((line, index) => line.length > 0 || index > 0);

	for (const entry of entries) {
		const matcher = new RegExp(`^\\s*${escapeRegExp(entry.key)}\\s*=`);
		const nextLine = `${entry.key}=${entry.value}`;
		const existingIndex = nextLines.findIndex((line) => matcher.test(line));

		if (existingIndex >= 0) {
			nextLines[existingIndex] = nextLine;
		} else {
			nextLines.push(nextLine);
		}
	}

	return nextLines.join("\n").trim();
};
