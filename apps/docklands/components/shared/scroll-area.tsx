"use client";

import * as React from "react";
import { cn } from "@/shared/utils";

const ScrollArea = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { viewPortClassName?: string }
>(({ className, viewPortClassName, children, ...props }, ref) => (
	<div ref={ref} className={cn("relative overflow-auto", className)} {...props}>
		<div className={cn("min-h-full", viewPortClassName)}>{children}</div>
	</div>
));
ScrollArea.displayName = "ScrollArea";

const ScrollBar = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
