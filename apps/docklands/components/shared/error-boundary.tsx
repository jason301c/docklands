"use client";

import { Component, type ReactNode } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { TabErrorState } from "@/components/shared/states";

const log = createClientLogger("error-boundary");

interface FallbackProps {
	error: Error;
	reset: () => void;
}

interface Props {
	children: ReactNode;
	/** Custom fallback; defaults to an inline retryable error state. */
	fallback?: (props: FallbackProps) => ReactNode;
	/**
	 * When this value changes the boundary clears its error and re-renders its
	 * children — use it to auto-recover when the user navigates to a different
	 * tab/route within a persistent boundary.
	 */
	resetKey?: unknown;
	onError?: (error: Error) => void;
	/** Label used in logs to identify which boundary tripped. */
	name?: string;
}

interface State {
	error: Error | null;
}

/**
 * Minimal in-house React error boundary.
 *
 * Wrap independently-throwable async surfaces (canvas drawer tabs, dialog
 * bodies, etc.) so a single render throw degrades to an inline, retryable
 * message instead of unmounting the whole subtree to Next's default error UI.
 * We keep our own ~50-LOC class rather than add a dependency.
 */
export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidUpdate(prevProps: Props) {
		if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
			this.reset();
		}
	}

	componentDidCatch(error: Error) {
		log.error(this.props.name ?? "boundary", error);
		this.props.onError?.(error);
	}

	reset = () => this.setState({ error: null });

	render() {
		const { error } = this.state;
		if (error) {
			if (this.props.fallback) {
				return this.props.fallback({ error, reset: this.reset });
			}
			return <TabErrorState error={error} onRetry={this.reset} />;
		}
		return this.props.children;
	}
}
