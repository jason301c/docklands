import { Button } from "@cloudflare/kumo/components/button";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { cn } from "@/shared/utils";

/**
 * Canonical loading / empty / error states.
 *
 * These replace the ~50 copy-pasted `min-h-[25vh] flex items-center justify-center`
 * spinner/empty blocks scattered across every `Show*` list, and give async
 * surfaces a real error state (previously query failures rendered as an empty
 * list with no indication anything went wrong). Use `QueryState` for the common
 * "list backed by one query" shape; reach for the individual primitives when a
 * surface needs custom composition.
 */

/** Shared vertical rhythm for a list/section placeholder. */
const STATE_SHELL = "min-h-[25vh]";

export function LoadingState({
	label = "Loading...",
	className,
}: {
	label?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-row items-center justify-center gap-2 text-sm text-kumo-subtle",
				STATE_SHELL,
				className,
			)}
		>
			<span>{label}</span>
			<Loader2 className="size-4 animate-spin" />
		</div>
	);
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: {
	icon?: LucideIcon;
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 text-center",
				STATE_SHELL,
				className,
			)}
		>
			{Icon ? <Icon className="size-8 text-kumo-subtle" /> : null}
			{title ? (
				<span className="text-base text-kumo-subtle">{title}</span>
			) : null}
			{description ? (
				<span className="max-w-md text-sm text-kumo-subtle">{description}</span>
			) : null}
			{action}
		</div>
	);
}

export function ErrorState({
	error,
	onRetry,
	title = "Something went wrong",
	className,
}: {
	error?: unknown;
	onRetry?: () => void;
	title?: string;
	className?: string;
}) {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: undefined;

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3",
				STATE_SHELL,
				className,
			)}
		>
			<AlertBlock type="error" className="w-full max-w-md">
				{message ? `${title}: ${message}` : title}
			</AlertBlock>
			{onRetry ? (
				<Button variant="secondary" onClick={onRetry}>
					Try again
				</Button>
			) : null}
		</div>
	);
}

interface QueryLike<T> {
	isPending: boolean;
	isError: boolean;
	error: unknown;
	data: T | undefined;
	refetch?: () => unknown;
}

/**
 * Renders the right state for a list/section backed by a single query:
 * spinner while pending, a retryable error state on failure (no longer a
 * silent empty list), the supplied empty state when there is no data, and
 * otherwise the children render prop with the resolved data.
 */
export function QueryState<T>({
	query,
	isEmpty,
	empty,
	loadingLabel,
	errorTitle,
	className,
	children,
}: {
	query: QueryLike<T>;
	isEmpty?: (data: T) => boolean;
	empty?: ReactNode;
	loadingLabel?: string;
	errorTitle?: string;
	className?: string;
	children: (data: T) => ReactNode;
}) {
	if (query.isError) {
		return (
			<ErrorState
				error={query.error}
				title={errorTitle}
				onRetry={query.refetch ? () => query.refetch?.() : undefined}
				className={className}
			/>
		);
	}

	if (query.isPending || query.data === undefined) {
		return <LoadingState label={loadingLabel} className={className} />;
	}

	if (isEmpty?.(query.data)) {
		return (
			<>
				{empty ?? (
					<EmptyState title="Nothing here yet." className={className} />
				)}
			</>
		);
	}

	return <>{children(query.data)}</>;
}

/** Inline error state sized for a tab/panel rather than a full route. */
export function TabErrorState({
	error,
	onRetry,
}: {
	error?: unknown;
	onRetry?: () => void;
}) {
	return <ErrorState error={error} onRetry={onRetry} className="min-h-48" />;
}
