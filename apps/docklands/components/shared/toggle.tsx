"use client";

import { Button, buttonVariants } from "@cloudflare/kumo/components/button";
import * as React from "react";
import { cn } from "@/shared/utils";

type ToggleProps = Omit<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	"onChange"
> & {
	pressed?: boolean;
	defaultPressed?: boolean;
	onPressedChange?: (pressed: boolean) => void;
};

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
	(
		{ pressed, defaultPressed = false, onPressedChange, className, ...props },
		ref,
	) => {
		const [internalPressed, setInternalPressed] =
			React.useState(defaultPressed);
		const isPressed = pressed ?? internalPressed;

		const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
			props.onClick?.(event);
			if (event.defaultPrevented) return;
			const nextPressed = !isPressed;
			setInternalPressed(nextPressed);
			onPressedChange?.(nextPressed);
		};

		return (
			<Button
				ref={ref}
				variant={isPressed ? "secondary" : "ghost"}
				className={cn(className)}
				aria-pressed={isPressed}
				{...props}
				onClick={handleClick}
			/>
		);
	},
);
Toggle.displayName = "Toggle";

const toggleVariants = buttonVariants;

export { Toggle, toggleVariants };
