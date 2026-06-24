"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/shared/utils";

/**
 * Shared building blocks for the onboarding/auth surface. The screens share one
 * visual language — a large left-aligned heading, tall rounded placeholder-only
 * fields, and a single high-contrast "ink" submit button — so every flow stays
 * consistent and DRY. The two-column shell lives in `OnboardingLayout`; these
 * are the per-screen form primitives that render inside it.
 *
 * Tokens are theme-aware on purpose: `bg-kumo-contrast` / `text-kumo-canvas`
 * invert between light and dark, so the ink button reads as near-black on light
 * and near-white on dark without per-mode overrides.
 */

/** Tall, rounded field styling shared by every auth input. */
export const authInputClassName = "h-11 rounded-xl";

/** High-contrast full-width submit button styling (the Creed "ink" CTA). */
export const authSubmitClassName =
	"h-11 w-full justify-center rounded-xl !bg-kumo-contrast !text-kumo-canvas hover:!bg-kumo-contrast/90";

/** Page heading + optional supporting copy, left-aligned above the form. */
export const AuthHeading = ({
	title,
	description,
}: {
	title: React.ReactNode;
	description?: React.ReactNode;
}) => (
	<div className="mb-8 flex flex-col gap-2">
		<h1 className="font-semibold text-3xl text-kumo-default tracking-tight sm:text-4xl">
			{title}
		</h1>
		{description ? (
			<p className="text-kumo-subtle text-sm">{description}</p>
		) : null}
	</div>
);

/** A standard auth text field — Kumo `Input` pre-sized for the auth surface. */
export const AuthInput = React.forwardRef<
	HTMLInputElement,
	React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => (
	<Input
		ref={ref}
		size="lg"
		className={cn(authInputClassName, className)}
		{...props}
	/>
));
AuthInput.displayName = "AuthInput";

/**
 * Password entry field with a reveal toggle (the Creed eye affordance). Built
 * on Kumo `Input` rather than `SensitiveInput` because this is credential
 * *entry* in a form — it integrates with react-hook-form via the native
 * `onChange`/`value` it receives, and intentionally omits the copy-to-clipboard
 * button `SensitiveInput` shows for displaying existing secrets.
 */
export const PasswordInput = React.forwardRef<
	HTMLInputElement,
	React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => {
	const [reveal, setReveal] = React.useState(false);
	return (
		<div className="relative w-full">
			<Input
				ref={ref}
				size="lg"
				className={cn(authInputClassName, "pr-11", className)}
				{...props}
				type={reveal ? "text" : "password"}
			/>
			<button
				type="button"
				aria-label={reveal ? "Hide password" : "Show password"}
				onClick={() => setReveal((value) => !value)}
				className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-kumo-subtle transition-colors hover:text-kumo-default"
			>
				{reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
			</button>
		</div>
	);
});
PasswordInput.displayName = "PasswordInput";

/** The high-emphasis form submit button shared across every auth screen. */
export const AuthSubmit = ({
	children,
	loading,
	className,
}: {
	children: React.ReactNode;
	loading?: boolean;
	className?: string;
}) => (
	<Button
		type="submit"
		size="lg"
		variant="primary"
		loading={loading}
		className={cn(authSubmitClassName, className)}
	>
		{children}
	</Button>
);

/** Muted, centered secondary action below the form (e.g. "Back to sign in"). */
export const AuthAltAction = ({ children }: { children: React.ReactNode }) => (
	<p className="mt-6 text-center text-kumo-subtle text-sm">{children}</p>
);

/** Inline link used inside `AuthAltAction` / field rows, emphasized but quiet. */
export const authLinkClassName =
	"text-sm font-medium text-kumo-default underline-offset-4 hover:underline";
