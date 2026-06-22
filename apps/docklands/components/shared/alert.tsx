"use client";

import { Banner } from "@cloudflare/kumo/components/banner";
import * as React from "react";
import { cn } from "@/shared/utils";

type AlertVariant = "default" | "destructive";

const Alert = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }
>(({ className, variant = "default", children, ...props }, ref) => (
	<div ref={ref} className={className} {...props}>
		<Banner variant={variant === "destructive" ? "error" : "secondary"}>
			{children}
		</Banner>
	</div>
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h5
		ref={ref}
		className={cn("font-medium text-kumo-default", className)}
		{...props}
	/>
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("text-sm text-kumo-subtle", className)}
		{...props}
	/>
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
