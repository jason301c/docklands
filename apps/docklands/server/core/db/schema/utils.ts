import { faker } from "@faker-js/faker";
import { customAlphabet } from "nanoid";
import { generatePassword } from "@/server/core/templates";

const alphabet = "abcdefghijklmnopqrstuvwxyz123456789";

const customNanoid = customAlphabet(alphabet, 6);

/**
 * App name: letters, numbers, dots, underscores, hyphens only (no spaces), and
 * never a `..` sequence. appName is joined into on-disk paths (and `rm -rf`'d),
 * so disallowing `..` prevents a crafted name from escaping its app directory.
 * The negative lookahead rejects any value containing `..`.
 */
export const APP_NAME_REGEX = /^(?!.*\.\.)[a-zA-Z0-9._-]+$/;

export const APP_NAME_MESSAGE =
	"App name can only contain letters, numbers, dots, underscores and hyphens (no '..')";

// Database password validation lives in a cross-runtime module so the server
// validators and the password UI form share one definition (see the file for
// why these characters are excluded).
export {
	DATABASE_PASSWORD_MESSAGE,
	DATABASE_PASSWORD_REGEX,
} from "@/shared/validation/database-password";

export const generateAppName = (type: string) => {
	const verb = faker.hacker.verb().replace(/ /g, "-");
	const adjective = faker.hacker.adjective().replace(/ /g, "-");
	const noun = faker.hacker.noun().replace(/ /g, "-");
	const randomFakerElement = `${verb}-${adjective}-${noun}`;
	const nanoidPart = customNanoid();
	return `${type}-${randomFakerElement}-${nanoidPart}`;
};

export const cleanAppName = (appName?: string) => {
	if (!appName) {
		return appName?.toLowerCase();
	}
	return appName.trim().replace(/ /g, "-").toLowerCase();
};

export const buildAppName = (type: string, baseAppName?: string) => {
	if (baseAppName) {
		return `${cleanAppName(baseAppName)}-${generatePassword(6)}`;
	}
	return generateAppName(type);
};
