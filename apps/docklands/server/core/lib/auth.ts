import type { IncomingMessage } from "node:http";
import { apiKey } from "@better-auth/api-key";
import * as bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization, twoFactor } from "better-auth/plugins";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { getPublicIpWithFallback } from "../runtime/host";
import { getTrustedOrigins, getUserByToken } from "../services/admin";
import { createAuditLog } from "../services/audit-log";
import {
	getWebServerSettings,
	updateWebServerSettings,
} from "../services/web-server-settings";
import { sendEmail } from "../verification/send-verification-email";
import { ac, adminRole, memberRole, ownerRole } from "./access-control";
import { betterAuthSecret } from "./auth-secret";

const isNextProductionBuild = () =>
	process.env.NEXT_PHASE === "phase-production-build";

// Resolve the Better Auth base URL.
// - If BETTER_AUTH_URL is set (recommended for prod/VM installs that have a
//   stable host or domain), use it so callback/verification links are absolute
//   and correct.
// - In development, default to localhost so local auth is deterministic and the
//   "Base URL is not set" warning goes away.
// - Otherwise (self-hosted prod without an explicit URL) leave it undefined so
//   Better Auth keeps deriving the origin from the incoming request, which is
//   the correct behavior for multi-host installs gated by trustedOrigins().
const resolveBaseURL = (): string | undefined => {
	if (process.env.BETTER_AUTH_URL) {
		return process.env.BETTER_AUTH_URL;
	}
	if (process.env.NODE_ENV !== "production") {
		return `http://localhost:${process.env.PORT || "3000"}`;
	}
	return undefined;
};

const { handler, api } = betterAuth({
	baseURL: resolveBaseURL(),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: schema,
	}),
	disabledPaths: [
		"/organization/create",
		"/organization/update",
		"/organization/delete",
		"/verify-email",
	],
	secret: betterAuthSecret,
	// Self-hosted installs are commonly reached over plain HTTP on a LAN/IP, so
	// cookies are not forced to Secure. Tightening this for HTTPS-behind-a-domain
	// is a separate decision.
	advanced: {
		useSecureCookies: false,
		defaultCookieAttributes: {
			sameSite: "lax",
			secure: false,
			httpOnly: true,
			path: "/",
		},
	},
	appName: "Docklands",
	logger: {
		disabled: process.env.NODE_ENV === "production",
	},
	async trustedOrigins() {
		if (isNextProductionBuild()) {
			return [];
		}
		try {
			const devOrigins =
				process.env.NODE_ENV === "development"
					? [
							`http://localhost:${process.env.PORT || "3000"}`,
							`http://127.0.0.1:${process.env.PORT || "3000"}`,
							`http://0.0.0.0:${process.env.PORT || "3000"}`,
							"https://absolutely-handy-falcon.ngrok-free.app",
						]
					: [];
			const [trustedOrigins, settings] = await Promise.all([
				getTrustedOrigins(),
				getWebServerSettings(),
			]);
			if (!settings) return devOrigins;
			return [
				...(settings?.serverIp ? [`http://${settings?.serverIp}:3000`] : []),
				...(settings?.host ? [`https://${settings?.host}`] : []),
				...devOrigins,
				...trustedOrigins,
			];
		} catch (error) {
			console.error("Failed to resolve trusted origins:", error);
			return [];
		}
	},
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		password: {
			async hash(password) {
				return bcrypt.hashSync(password, 10);
			},
			async verify({ hash, password }) {
				return bcrypt.compareSync(password, hash);
			},
		},
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				email: user.email,
				subject: "Reset your password",
				text: `
				<p>Click the link to reset your password: <a href="${url}">Reset Password</a></p>
				`,
			});
		},
	},
	databaseHooks: {
		user: {
			create: {
				before: async (_user, context) => {
					const xDocklandsToken =
						context?.request?.headers?.get("x-docklands-token");
					if (xDocklandsToken) {
						let invitation: Awaited<ReturnType<typeof getUserByToken>>;
						try {
							invitation = await getUserByToken(xDocklandsToken);
						} catch {
							throw new APIError("BAD_REQUEST", {
								message: "Invalid invitation token",
							});
						}
						if (invitation.isExpired) {
							throw new APIError("BAD_REQUEST", {
								message: "Invitation has expired",
							});
						}
						if (invitation.status !== "pending") {
							throw new APIError("BAD_REQUEST", {
								message: "Invitation has already been used",
							});
						}
						if (
							_user.email.toLowerCase().trim() !==
							invitation.email.toLowerCase().trim()
						) {
							throw new APIError("BAD_REQUEST", {
								message: "Email does not match invitation",
							});
						}
					} else {
						const isAdminPresent = await db.query.member.findFirst({
							where: eq(schema.member.role, "owner"),
						});
						if (isAdminPresent) {
							throw new APIError("BAD_REQUEST", {
								message: "Admin is already created",
							});
						}
					}
				},
				after: async (user) => {
					const isAdminPresent = await db.query.member.findFirst({
						where: eq(schema.member.role, "owner"),
					});

					// The first registrant becomes the single owner: record the
					// server IP and create their default organization.
					if (!isAdminPresent) {
						await updateWebServerSettings({
							serverIp: await getPublicIpWithFallback(),
						});

						await db.transaction(async (tx) => {
							const organization = await tx
								.insert(schema.organization)
								.values({
									name: "My Organization",
									ownerId: user.id,
									createdAt: new Date(),
								})
								.returning()
								.then((res) => res[0]);

							await tx.insert(schema.member).values({
								userId: user.id,
								organizationId: organization?.id || "",
								role: "owner",
								createdAt: new Date(),
								isDefault: true, // Mark first organization as default
							});
						});
					}
				},
			},
		},
		session: {
			create: {
				before: async (session) => {
					// Find the default organization for this user
					// Priority: 1) isDefault=true, 2) most recently created
					const member = await db.query.member.findFirst({
						where: eq(schema.member.userId, session.userId),
						orderBy: [
							desc(schema.member.isDefault),
							desc(schema.member.createdAt),
						],
						with: {
							organization: true,
						},
					});

					return {
						data: {
							...session,
							activeOrganizationId: member?.organization.id,
						},
					};
				},
				after: async (session) => {
					const orgId = (
						session as typeof session & { activeOrganizationId?: string }
					).activeOrganizationId;
					if (!orgId) return;
					const memberRecord = await db.query.member.findFirst({
						where: and(
							eq(schema.member.userId, session.userId),
							eq(schema.member.organizationId, orgId),
						),
						with: { user: true },
					});
					if (!memberRecord) return;
					await createAuditLog({
						organizationId: orgId,
						userId: session.userId,
						userEmail: memberRecord.user.email,
						userRole: memberRecord.role,
						action: "login",
						resourceType: "session",
					});
				},
			},
			delete: {
				after: async (session) => {
					const orgId = (
						session as typeof session & { activeOrganizationId?: string }
					).activeOrganizationId;
					if (!orgId) return;
					const memberRecord = await db.query.member.findFirst({
						where: and(
							eq(schema.member.userId, session.userId),
							eq(schema.member.organizationId, orgId),
						),
						with: { user: true },
					});
					if (!memberRecord) return;
					await createAuditLog({
						organizationId: orgId,
						userId: session.userId,
						userEmail: memberRecord.user.email,
						userRole: memberRecord.role,
						action: "logout",
						resourceType: "session",
					});
				},
			},
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 3,
		updateAge: 60 * 60 * 24,
	},
	user: {
		modelName: "user",
		fields: {
			name: "firstName", // Map better-auth's default 'name' field to 'firstName' column
		},
		additionalFields: {
			role: {
				type: "string",
				// required: true,
				input: false,
			},
			ownerId: {
				type: "string",
				// required: true,
				input: false,
			},
			allowImpersonation: {
				fieldName: "allowImpersonation",
				type: "boolean",
				defaultValue: false,
			},
			lastName: {
				type: "string",
				required: false,
				input: true,
				defaultValue: "",
			},
		},
	},
	plugins: [
		apiKey({
			enableMetadata: true,
			references: "user",
		}),
		twoFactor(),
		organization({
			ac,
			roles: {
				owner: ownerRole,
				admin: adminRole,
				member: memberRole,
			},
			dynamicAccessControl: {
				enabled: true,
				maximumRolesPerOrganization: 10,
			},
		}),
	],
});

const _auth = {
	handler,
	createApiKey: api.createApiKey,
};

export type AuthType = typeof _auth;
export const auth: AuthType = _auth;

export const validateRequestHeaders = async (headers: Headers) => {
	const apiKey = headers.get("x-api-key") || "";
	if (apiKey) {
		try {
			const { valid, key, error } = await api.verifyApiKey({
				body: {
					key: apiKey,
				},
			});

			if (error) {
				throw new Error(error.message?.toString() || "Error verifying API key");
			}
			if (!valid || !key) {
				return {
					session: null,
					user: null,
				};
			}

			const apiKeyRecord = await db.query.apikey.findFirst({
				where: eq(schema.apikey.id, key.id),
				with: {
					user: true,
				},
			});

			if (!apiKeyRecord) {
				return {
					session: null,
					user: null,
				};
			}

			const organizationId = (
				JSON.parse(apiKeyRecord.metadata || "{}") as {
					organizationId?: string;
				}
			).organizationId;

			if (!organizationId) {
				return {
					session: null,
					user: null,
				};
			}

			const member = await db.query.member.findFirst({
				where: and(
					eq(schema.member.userId, apiKeyRecord.user.id),
					eq(schema.member.organizationId, organizationId),
				),
				with: {
					organization: true,
				},
			});

			// When accessing from DB, use actual column names
			const userFromDb = apiKeyRecord.user as typeof apiKeyRecord.user & {
				firstName: string;
				lastName: string;
			};

			const mockSession = {
				session: {
					userId: apiKeyRecord.user.id,
					activeOrganizationId: organizationId || "",
				},
				user: {
					id: userFromDb.id,
					name: userFromDb.firstName, // Map firstName back to name for better-auth
					email: userFromDb.email,
					emailVerified: userFromDb.emailVerified,
					image: userFromDb.image,
					createdAt: userFromDb.createdAt,
					updatedAt: userFromDb.updatedAt,
					twoFactorEnabled: userFromDb.twoFactorEnabled,
					role: member?.role || "member",
					ownerId: member?.organization.ownerId || apiKeyRecord.user.id,
				},
			};

			return mockSession;
		} catch (error) {
			console.error("Error verifying API key", error);
			return {
				session: null,
				user: null,
			};
		}
	}

	// If no API key, proceed with normal session validation
	const session = await api.getSession({
		headers,
	});

	if (!session?.session || !session.user) {
		return {
			session: null,
			user: null,
		};
	}

	if (session?.user) {
		const member = await db.query.member.findFirst({
			where: and(
				eq(schema.member.userId, session.user.id),
				...(session.session.activeOrganizationId
					? [
							eq(
								schema.member.organizationId,
								session.session.activeOrganizationId || "",
							),
						]
					: []),
			),
			orderBy: [desc(schema.member.isDefault), desc(schema.member.createdAt)],
			with: {
				organization: true,
				user: true,
			},
		});

		session.user.role = member?.role || "member";
		session.session.activeOrganizationId = member?.organization.id || "";
		if (member) {
			session.user.ownerId = member.organization.ownerId;
		} else {
			session.user.ownerId = session.user.id;
		}
	}

	return session;
};

export const validateRequest = async (request: IncomingMessage) => {
	const headers = new Headers();
	const cookie = request.headers.cookie;
	const apiKey = request.headers["x-api-key"];

	if (cookie) {
		headers.set("cookie", cookie);
	}
	if (Array.isArray(apiKey)) {
		headers.set("x-api-key", apiKey[0] || "");
	} else if (apiKey) {
		headers.set("x-api-key", apiKey);
	}

	return validateRequestHeaders(headers);
};
