export type EnvEntry = {
	key: string;
	value: string;
};

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
