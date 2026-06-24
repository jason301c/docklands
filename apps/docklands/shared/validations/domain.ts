import { z } from "zod";

// Domain host/path/middleware values flow unescaped into Traefik router rules
// (`Host(`<host>`) && PathPrefix(`<path>`)`) and into the `middlewares:` list of
// the generated dynamic-config YAML. A backtick, space, or parenthesis in any of
// these would let a crafted value break out of its rule clause and inject extra
// matchers (e.g. `evil.com`) || HostRegexp(`.+`)` turns one domain into a
// catch-all that hijacks all ingress). `new URL(...).hostname` does NOT sanitize
// this — when the authority is invalid it throws and the host is used verbatim —
// so the only safe place to reject it is here, at the validation boundary that
// every create/update path shares. Constrain each value to the characters that
// are actually legal for its purpose; anything else is rejected before it can
// reach the DB or the rule builder.

// A DNS hostname (optionally a single leading `*.` wildcard label, for wildcard
// certificates). Labels are alphanumeric with internal hyphens; this excludes
// backticks, spaces, parentheses, and the other Traefik rule metacharacters.
const HOSTNAME_REGEX =
	/^(\*\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// A URL path: must start with `/` and use only unreserved/sub-delim path
// characters. Notably excludes backticks, whitespace, and parentheses so it can
// never close the PathPrefix(`...`) clause and append a new matcher.
const URL_PATH_REGEX = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%]*$/;

// A Traefik middleware reference name: `name` or `name@provider`. Restricted to
// the identifier charset Traefik itself accepts, so a crafted name can't carry
// rule metacharacters or YAML-breaking content into the router config.
const MIDDLEWARE_NAME_REGEX = /^[A-Za-z0-9_.-]+(@[A-Za-z0-9_.-]+)?$/;

const hostSchema = z
	.string()
	.min(1, { message: "Add a hostname" })
	.refine((val) => val === val.trim(), {
		message: "Domain name cannot have leading or trailing spaces",
	})
	.transform((val) => val.trim())
	.refine((val) => HOSTNAME_REGEX.test(val), {
		message: "Enter a valid domain name (letters, digits, hyphens, and dots)",
	});

const pathSchema = z
	.string()
	.min(1)
	.refine((val) => URL_PATH_REGEX.test(val), {
		message: "Path must start with '/' and contain only valid URL characters",
	});

const internalPathSchema = z
	.string()
	.refine((val) => val === "" || URL_PATH_REGEX.test(val), {
		message:
			"Internal path must start with '/' and contain only valid URL characters",
	});

const middlewaresSchema = z.array(
	z.string().refine((val) => MIDDLEWARE_NAME_REGEX.test(val), {
		message:
			"Middleware names may only contain letters, digits, '-', '_', '.', and an optional '@provider' suffix",
	}),
);

export const domain = z
	.object({
		host: hostSchema,
		path: pathSchema.nullish(),
		internalPath: internalPathSchema.nullish(),
		stripPath: z.boolean().optional(),
		port: z
			.number()
			.min(1, { message: "Port must be at least 1" })
			.max(65535, { message: "Port must be 65535 or below" })
			.nullish(),
		https: z.boolean().optional(),
		certificateType: z.enum(["letsencrypt", "none", "custom"]).optional(),
		customCertResolver: z.string().nullish(),
		middlewares: middlewaresSchema.nullish(),
	})
	.superRefine((input, ctx) => {
		if (input.https && !input.certificateType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["certificateType"],
				message: "Required",
			});
		}

		if (input.certificateType === "custom" && !input.customCertResolver) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["customCertResolver"],
				message: "Required when certificate type is custom",
			});
		}

		// Validate stripPath requires a valid path
		if (input.stripPath && (!input.path || input.path === "/")) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["stripPath"],
				message:
					"Strip path can only be enabled when a path other than '/' is specified",
			});
		}

		// Validate internalPath starts with /
		if (
			input.internalPath &&
			input.internalPath !== "/" &&
			!input.internalPath.startsWith("/")
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["internalPath"],
				message: "Internal path must start with '/'",
			});
		}
	});

export const domainCompose = z
	.object({
		host: hostSchema,
		path: pathSchema.nullish(),
		internalPath: internalPathSchema.nullish(),
		stripPath: z.boolean().optional(),
		port: z
			.number()
			.min(1, { message: "Port must be at least 1" })
			.max(65535, { message: "Port must be 65535 or below" })
			.nullish(),
		https: z.boolean().optional(),
		certificateType: z.enum(["letsencrypt", "none", "custom"]).optional(),
		customCertResolver: z.string().nullish(),
		serviceName: z.string().min(1, { message: "Service name is required" }),
		middlewares: middlewaresSchema.nullish(),
	})
	.superRefine((input, ctx) => {
		if (input.https && !input.certificateType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["certificateType"],
				message: "Required",
			});
		}

		if (input.certificateType === "custom" && !input.customCertResolver) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["customCertResolver"],
				message: "Required when certificate type is custom",
			});
		}

		// Validate stripPath requires a valid path
		if (input.stripPath && (!input.path || input.path === "/")) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["stripPath"],
				message:
					"Strip path can only be enabled when a path other than '/' is specified",
			});
		}

		// Validate internalPath starts with /
		if (
			input.internalPath &&
			input.internalPath !== "/" &&
			!input.internalPath.startsWith("/")
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["internalPath"],
				message: "Internal path must start with '/'",
			});
		}
	});
