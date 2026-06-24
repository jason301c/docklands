import { parse, stringify, YAMLParseError } from "yaml";

export const validateAndFormatYAML = (yamlText: string) => {
	try {
		const obj = parse(yamlText);
		const formattedYaml = stringify(obj, { indent: 4 });
		return { valid: true, formattedYaml, error: null };
	} catch (error) {
		if (error instanceof YAMLParseError) {
			return {
				valid: false,
				formattedYaml: yamlText,
				error: error.message,
			};
		}
		return {
			valid: false,
			formattedYaml: yamlText,
			error: "An unexpected error occurred while processing the YAML.",
		};
	}
};
