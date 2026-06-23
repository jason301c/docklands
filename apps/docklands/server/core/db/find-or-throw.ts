import { TRPCError } from "@trpc/server";

/**
 * Awaits a Drizzle (or any) query that may resolve to `undefined`/`null` and
 * throws a standard tRPC `NOT_FOUND` (`"<label> not found"`) when it does.
 *
 * The generic preserves the exact inferred result type — including `with`
 * relations and `columns` projections — so callers are unaffected. Use it only
 * where the existing block is the plain "find-or-throw-NOT_FOUND" shape; leave
 * blocks with custom codes/messages or extra logic untouched.
 */
export const orThrowNotFound = async <T>(
	query: Promise<T | undefined | null>,
	label: string,
): Promise<T> => {
	const result = await query;
	if (!result) {
		throw new TRPCError({ code: "NOT_FOUND", message: `${label} not found` });
	}
	return result;
};
