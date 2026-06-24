/**
 * Client-side classification and global surfacing of tRPC/React Query errors.
 *
 * This is the single place that decides what a failed query/mutation *means*
 * (auth loss vs. forbidden vs. a transport failure vs. a generic server error)
 * and how it should be surfaced to the user. The global `QueryCache` /
 * `MutationCache` handlers in `trpc-provider.tsx` delegate here so that no call
 * site needs bespoke error plumbing for a failure to be visible — the root
 * cause of the original "dead buttons" symptom (an errored batch resolving to
 * `data: undefined` with no toast, log, or boundary trip).
 */

import { TRPCClientError } from "@trpc/client";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const log = createClientLogger("trpc");

export interface ClassifiedError {
	/** tRPC error code (e.g. `UNAUTHORIZED`), or `null` for a transport failure. */
	code: string | null;
	message: string;
	/** Session/auth loss — the user needs to sign in again. */
	isAuth: boolean;
	/** Authorized session but insufficient permission for this action. */
	isForbidden: boolean;
	/** No tRPC-shaped response came back at all (server down, offline, CORS). */
	isNetwork: boolean;
}

export function classifyError(error: unknown): ClassifiedError {
	if (error instanceof TRPCClientError) {
		const code = (error.data?.code as string | undefined) ?? null;
		// A tRPC client error with no structured `data` means the request never
		// reached a tRPC handler — a transport/network failure rather than an
		// application error.
		const isNetwork = code === null;
		return {
			code,
			message: error.message || "Something went wrong",
			isAuth: code === "UNAUTHORIZED",
			isForbidden: code === "FORBIDDEN",
			isNetwork,
		};
	}

	const message =
		error instanceof Error ? error.message : "Something went wrong";
	return {
		code: null,
		message,
		isAuth: false,
		isForbidden: false,
		isNetwork: true,
	};
}

/**
 * Whether React Query should retry a failed request. Auth/permission/client
 * errors are deterministic and must not be retried; transient network/5xx
 * failures get a couple of attempts.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
	const { code, isAuth, isForbidden } = classifyError(error);
	if (isAuth || isForbidden) return false;
	if (code === "NOT_FOUND" || code === "BAD_REQUEST" || code === "CONFLICT") {
		return false;
	}
	return failureCount < 2;
}

// Collapse bursts of identical errors (e.g. every query in a failed batch) into
// a single toast within a short window.
const recentlyNotified = new Map<string, number>();
function shouldNotify(key: string, windowMs = 4000): boolean {
	const now = Date.now();
	const expiresAt = recentlyNotified.get(key);
	if (expiresAt && expiresAt > now) return false;
	recentlyNotified.set(key, now + windowMs);
	// Opportunistic cleanup so the map cannot grow unbounded.
	if (recentlyNotified.size > 64) {
		for (const [k, exp] of recentlyNotified) {
			if (exp <= now) recentlyNotified.delete(k);
		}
	}
	return true;
}

function redirectToLogin() {
	if (typeof window === "undefined") return;
	// Only bounce out of authenticated areas, and never loop on the login route.
	if (!window.location.pathname.startsWith("/dashboard")) return;
	window.location.href = "/";
}

export type GlobalErrorSource = "query" | "mutation";

/**
 * Central handler for the global React Query caches.
 *
 * - Always logs (so failures are visible in the console / error reporting even
 *   when the user also sees a toast).
 * - `UNAUTHORIZED` → session-expired toast + redirect to login.
 * - `FORBIDDEN` → a permission toast.
 * - Generic errors → toast for queries (which otherwise fail silently). For
 *   mutations the local handler / `useCrudMutation` owns the user-facing toast,
 *   so the global handler stays quiet unless explicitly opted in via
 *   `mutation.meta.globalErrorToast` to avoid double-toasting.
 */
export function handleGlobalError(
	error: unknown,
	source: GlobalErrorSource,
	opts: { toastGeneric?: boolean } = {},
) {
	const classified = classifyError(error);
	log.error(
		`${source} failed`,
		classified.code ?? "NETWORK",
		classified.message,
		error,
	);

	if (classified.isAuth) {
		if (shouldNotify("auth")) {
			toast.error("Your session expired. Please sign in again.");
		}
		redirectToLogin();
		return;
	}

	if (classified.isForbidden) {
		if (shouldNotify(`forbidden:${classified.message}`)) {
			toast.error(
				classified.message || "You don't have permission to do that.",
			);
		}
		return;
	}

	const wantToast = source === "query" || opts.toastGeneric;
	if (!wantToast) return;

	const message = classified.isNetwork
		? "Network error — check your connection and try again."
		: classified.message;
	if (shouldNotify(`${source}:${classified.code}:${message}`)) {
		toast.error(message);
	}
}
