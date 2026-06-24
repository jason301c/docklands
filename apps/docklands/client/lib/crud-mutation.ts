/**
 * Standard option factory for tRPC create/update/delete mutations.
 *
 * The audit found mutation handling copy-pasted across ~145 files: each one
 * hand-rolls `mutateAsync().then(...).catch(...)` with its own toast strings,
 * mixes `await` with `.then`, and refreshes the cache inconsistently
 * (`refetch()` vs `invalidate()`), so sibling lists drift after writes. This
 * factory produces the canonical `{ onSuccess, onError, onSettled }` you pass
 * straight into `api.<router>.<proc>.useMutation(...)`, so the call site stays
 * fully typed while toast + scoped logging + cache invalidation become
 * declarative and uniform.
 *
 * @example
 * const utils = api.useUtils();
 * const { mutateAsync, isPending } = api.gitlab.create.useMutation(
 *   crudMutationOptions({
 *     successMessage: "GitLab created successfully",
 *     errorMessage: "Error configuring GitLab",
 *     loggerScope: "git-providers",
 *     invalidate: () => utils.gitProvider.getAll.invalidate(),
 *     onSuccess: () => setIsOpen(false),
 *   }),
 * );
 * // in the submit handler, just: await mutateAsync(payload)
 *
 * Error surfacing composes with the global MutationCache handler
 * (`trpc-error.ts`): auth/permission failures are owned globally (session
 * redirect / permission toast), so this factory stays silent for those and
 * only toasts the supplied `errorMessage` for genuine operation failures —
 * never a double toast.
 */

import { createClientLogger } from "@/client/lib/logger";
import { classifyError } from "@/client/lib/trpc-error";
import { toast } from "@/components/shared/toast";

/** A callback that may run synchronously or return a promise we await. */
type MaybeAsync = () => unknown;

export interface CrudMutationOptions<TData, TVariables> {
	/** Toast shown on success (string, or derived from the result). */
	successMessage?: string | ((data: TData) => string);
	/** Toast shown on a genuine operation failure. */
	errorMessage?: string;
	/**
	 * Whether to toast `errorMessage` on failure. Set `false` when the caller
	 * already shows an inline error (e.g. a dialog `AlertBlock` bound to
	 * `isError`); the failure is still logged. Defaults to `true`.
	 */
	toastError?: boolean;
	/** Logger scope, e.g. "git-providers". */
	loggerScope?: string;
	/**
	 * Cache invalidation to run on success — call your `utils.<router>.invalidate()`
	 * here. Prefer `invalidate()` over `refetch()` so every subscriber refreshes,
	 * not just the list that issued the write.
	 */
	invalidate?: MaybeAsync;
	/** Extra success work (close a dialog, reset a form, navigate, …). */
	onSuccess?: (data: TData, variables: TVariables) => unknown;
	/** Extra error work beyond the standard toast/log. */
	onError?: (error: unknown) => void;
	/** Always runs after success or error. */
	onSettled?: MaybeAsync;
}

export function crudMutationOptions<TData = unknown, TVariables = unknown>(
	options: CrudMutationOptions<TData, TVariables>,
): {
	onSuccess: (data: TData, variables: TVariables) => Promise<void>;
	onError: (error: unknown) => void;
	onSettled: () => void;
} {
	const log = createClientLogger(options.loggerScope ?? "mutation");

	return {
		onSuccess: async (data, variables) => {
			if (options.invalidate) await options.invalidate();
			if (options.successMessage) {
				const message =
					typeof options.successMessage === "function"
						? options.successMessage(data)
						: options.successMessage;
				toast.success(message);
			}
			await options.onSuccess?.(data, variables);
		},
		onError: (error) => {
			const { isAuth, isForbidden } = classifyError(error);
			// Session/permission failures are surfaced + handled globally; don't
			// double-toast them with an operation-specific message here.
			if (!isAuth && !isForbidden) {
				log.error(options.errorMessage ?? "Mutation failed", error);
				if (options.toastError !== false) {
					toast.error(options.errorMessage ?? "Something went wrong");
				}
			}
			options.onError?.(error);
		},
		onSettled: () => options.onSettled?.(),
	};
}
