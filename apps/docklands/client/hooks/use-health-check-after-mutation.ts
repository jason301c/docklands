import { useCallback, useEffect, useRef, useState } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("health-check");

const HEALTH_CHECK_URL = "/api/health";

export interface UseHealthCheckAfterMutationOptions {
	/**
	 * Delay in ms before starting to poll the health endpoint.
	 * Gives time for the service (e.g. Traefik) to restart.
	 * @default 5000
	 */
	initialDelay?: number;
	/**
	 * Delay in ms between each health check poll.
	 * @default 2000
	 */
	pollInterval?: number;
	/**
	 * Maximum number of health-check polls before giving up. With the default
	 * 2s interval this is a ~2 minute ceiling so a service that never comes back
	 * cannot poll forever.
	 * @default 60
	 */
	maxAttempts?: number;
	/**
	 * Message shown in toast when the operation completes successfully.
	 */
	successMessage: string;
	/**
	 * Message shown when the service never returns healthy within maxAttempts.
	 */
	timeoutMessage?: string;
	/**
	 * Callback when health check passes. Use for refetching data.
	 */
	onSuccess?: () => void | Promise<void>;
	/**
	 * If true, reloads the page when health check passes (e.g. for runtimeWorker update).
	 * @default false
	 */
	reloadOnSuccess?: boolean;
}

export const useHealthCheckAfterMutation = ({
	initialDelay = 5000,
	pollInterval = 2000,
	maxAttempts = 60,
	successMessage,
	timeoutMessage = "The service did not come back online in time. Please refresh the page.",
	onSuccess,
	reloadOnSuccess = false,
}: UseHealthCheckAfterMutationOptions) => {
	const [isExecuting, setIsExecuting] = useState(false);
	// Guards async callbacks/setState/reload from running after unmount.
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const checkHealth = useCallback(async (): Promise<boolean> => {
		try {
			const response = await fetch(HEALTH_CHECK_URL);
			return response.ok;
		} catch {
			logger.debug("health endpoint unreachable, will retry");
			return false;
		}
	}, []);

	const pollUntilHealthy = useCallback(async (): Promise<void> => {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (!mountedRef.current) return;

			if (await checkHealth()) {
				if (!mountedRef.current) return;
				toast.success(successMessage);

				if (reloadOnSuccess) {
					setTimeout(() => {
						window.location.reload();
					}, 2000);
				} else {
					await onSuccess?.();
				}
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, pollInterval));
		}

		// Exhausted every attempt without the service coming back healthy.
		if (!mountedRef.current) return;
		logger.error(
			{ maxAttempts, pollInterval },
			"service did not become healthy in time",
		);
		toast.error(timeoutMessage);
	}, [
		checkHealth,
		successMessage,
		timeoutMessage,
		reloadOnSuccess,
		onSuccess,
		pollInterval,
		maxAttempts,
	]);

	const execute = useCallback(
		async <T>(mutationFn: () => Promise<T>): Promise<T> => {
			setIsExecuting(true);

			try {
				const result = await mutationFn();

				// Give time for the service to restart before polling
				await new Promise((resolve) => setTimeout(resolve, initialDelay));

				await pollUntilHealthy();

				return result;
			} finally {
				if (mountedRef.current) setIsExecuting(false);
			}
		},
		[initialDelay, pollUntilHealthy],
	);

	return { execute, isExecuting };
};
