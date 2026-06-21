"use client";

import {
	Toasty,
	createKumoToastManager,
	type KumoToastManagerAddOptions,
} from "@cloudflare/kumo/components/toast";
import * as React from "react";

type ToastMessage = React.ReactNode;
type ToastOptions = Omit<KumoToastManagerAddOptions<any>, "title"> & {
	description?: React.ReactNode;
	id?: string;
	duration?: number;
};

const toastManager = createKumoToastManager();

const toTitle = (message: ToastMessage) =>
	typeof message === "string" ? message : "Notification";

const toContent = (message: ToastMessage, description?: React.ReactNode) => {
	if (typeof message === "string") return undefined;
	return description ? (
		<div className="space-y-1">
			<div>{message}</div>
			<div>{description}</div>
		</div>
	) : (
		message
	);
};

const addToast = (
	message: ToastMessage,
	variant: KumoToastManagerAddOptions<any>["variant"] = "default",
	options: ToastOptions = {},
) => {
	const { duration: _duration, ...kumoOptions } = options;

	return toastManager.add({
		...kumoOptions,
		title: toTitle(message),
		description: options.description,
		content: options.content ?? toContent(message, options.description),
		variant,
	});
};

function baseToast(message: ToastMessage, options?: ToastOptions) {
	return addToast(message, "default", options);
}

export const toast = Object.assign(baseToast, {
	success: (message: ToastMessage, options?: ToastOptions) =>
		addToast(message, "success", options),
	error: (message: ToastMessage, options?: ToastOptions) =>
		addToast(message, "error", options),
	info: (message: ToastMessage, options?: ToastOptions) =>
		addToast(message, "info", options),
	warning: (message: ToastMessage, options?: ToastOptions) =>
		addToast(message, "warning", options),
	dismiss: (id?: string) => toastManager.close(id),
	promise: <T,>(
		promise: Promise<T>,
		options: {
			loading: ToastMessage | ToastOptions;
			success: ToastMessage | ToastOptions | ((data: T) => ToastMessage | ToastOptions);
			error:
				| ToastMessage
				| ToastOptions
				| ((error: Error) => ToastMessage | ToastOptions);
		},
	) =>
		toastManager.promise(promise, {
			loading: normalizePromiseOption(options.loading, "info"),
			success: (data) =>
				normalizePromiseOption(
					typeof options.success === "function"
						? options.success(data)
						: options.success,
					"success",
				),
			error: (error) =>
				normalizePromiseOption(
					typeof options.error === "function"
						? options.error(error)
						: options.error,
					"error",
				),
		}),
});

function normalizePromiseOption(
	option: ToastMessage | ToastOptions,
	variant: KumoToastManagerAddOptions<any>["variant"],
): KumoToastManagerAddOptions<any> {
	if (
		option &&
		typeof option === "object" &&
		!("type" in option) &&
		("title" in option || "description" in option || "content" in option)
	) {
		return {
			...(option as ToastOptions),
			title:
				"title" in option && option.title
					? (option.title as React.ReactNode)
					: "Notification",
			variant,
		};
	}

	return {
		title: toTitle(option as ToastMessage),
		content: toContent(option as ToastMessage),
		variant,
	};
}

export function Toaster({ children }: { children?: React.ReactNode }) {
	return <Toasty toastManager={toastManager}>{children ?? null}</Toasty>;
}
