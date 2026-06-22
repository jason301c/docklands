/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { Session, User } from "better-auth";
import superjson from "superjson";
import { ZodError } from "zod";
// import { getServerAuthSession } from "@/server/auth";
import { db } from "@/server/core/db";
import type { statements } from "@/server/core/lib/access-control";
import {
	validateRequest,
	validateRequestHeaders,
} from "@/server/core/lib/auth";
import type { OpenApiMeta } from "@/server/core/openapi/types";
import { checkPermission } from "@/server/core/services/permission";

type Resource = keyof typeof statements;
type ActionOf<R extends Resource> = (typeof statements)[R][number];
type RequestLike = {
	headers: Record<string, string | string[] | undefined>;
};
type ResponseLike = { headers: Headers };

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateContextOptions {
	user:
		| (User & {
				role: "member" | "admin" | "owner";
				ownerId: string;
		  })
		| null;
	session:
		| (Session & { activeOrganizationId: string; impersonatedBy?: string })
		| null;
	req: RequestLike;
	res: ResponseLike;
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
const createInnerTRPCContext = (opts: CreateContextOptions) => {
	return {
		session: opts.session,
		db,
		req: opts.req,
		res: opts.res,
		user: opts.user,
	};
};

export type TRPCContext = ReturnType<typeof createInnerTRPCContext>;

const normalizeContextUser = (
	user: Awaited<ReturnType<typeof validateRequestHeaders>>["user"],
) =>
	user
		? {
				...user,
				email: user.email,
				role: user.role as "owner" | "member" | "admin",
				id: user.id,
				ownerId: user.ownerId,
			}
		: null;

const normalizeContextSession = (
	session: Awaited<ReturnType<typeof validateRequestHeaders>>["session"],
) =>
	session
		? {
				...session,
				activeOrganizationId: session.activeOrganizationId || "",
			}
		: null;

const requestHeadersToObject = (headers: Headers) =>
	Object.fromEntries(headers.entries()) as Record<
		string,
		string | string[] | undefined
	>;

const nodeHeadersToObject = (headers: IncomingHttpHeaders) =>
	Object.fromEntries(Object.entries(headers)) as Record<
		string,
		string | string[] | undefined
	>;

export const createFetchTRPCContext = async (
	opts: FetchCreateContextFnOptions,
) => {
	const { req, resHeaders } = opts;
	const { session, user } = await validateRequestHeaders(req.headers);

	return createInnerTRPCContext({
		req: {
			headers: requestHeadersToObject(req.headers),
		},
		res: {
			headers: resHeaders,
		},
		session: normalizeContextSession(session),
		user: normalizeContextUser(user),
	});
};

export const createWebSocketTRPCContext = async (opts: {
	req: IncomingMessage;
}) => {
	const { session, user } = await validateRequest(opts.req);

	return createInnerTRPCContext({
		req: {
			headers: nodeHeadersToObject(opts.req.headers),
		},
		res: {
			headers: new Headers(),
		},
		session: normalizeContextSession(session),
		user: normalizeContextUser(user),
	});
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get type safety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC
	.meta<OpenApiMeta>()
	.context<TRPCContext>()
	.create({
		transformer: superjson,
		errorFormatter({ shape, error }) {
			return {
				...shape,
				data: {
					...shape.data,
					zodError:
						error.cause instanceof ZodError ? error.cause.flatten() : null,
				},
			};
		},
	});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session || !ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

export const cliProcedure = t.procedure.use(({ ctx, next }) => {
	if (
		!ctx.session ||
		!ctx.user ||
		(ctx.user.role !== "owner" && ctx.user.role !== "admin")
	) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
	if (
		!ctx.session ||
		!ctx.user ||
		(ctx.user.role !== "owner" && ctx.user.role !== "admin")
	) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			// infers the `session` as non-nullable
			session: ctx.session,
			user: ctx.user,
			// session: { ...ctx.session, user: ctx.user },
		},
	});
});

/**
 * Permission-checked procedure factory.
 *
 * Verifies the caller has the required resource+action permission before the
 * handler runs. Works for all role types:
 * - owner/admin use static full-access roles
 * - member uses static read defaults plus member permission flags
 * - custom roles use organization-defined permissions
 *
 * Usage:
 *   create: withPermission("project", "create")
 *     .input(...)
 *     .mutation(async ({ ctx, input }) => { ... })
 */
export const withPermission = <R extends Resource>(
	resource: R,
	action: ActionOf<R>,
) =>
	protectedProcedure.use(async ({ ctx, next }) => {
		await checkPermission(ctx, { [resource]: [action] } as any);
		return next();
	});
