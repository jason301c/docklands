"use client";

import * as React from "react";
import { isSolidColorAvatar } from "@/shared/avatar-utils";
import { cn } from "@/shared/utils";

const Avatar = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-kumo-fill",
			className,
		)}
		{...props}
	/>
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
	HTMLImageElement,
	React.ImgHTMLAttributes<HTMLImageElement> & { src?: string | null }
>(({ className, src, ...props }, ref) => {
	if (!src) {
		return null;
	}

	if (isSolidColorAvatar(src)) {
		return (
			<div
				className={cn("aspect-square h-full w-full rounded-full", className)}
				style={{ backgroundColor: src ?? undefined }}
			/>
		);
	}

	return (
		<img
			ref={ref}
			className={cn("aspect-square h-full w-full object-cover", className)}
			src={src}
			alt={props.alt ?? ""}
			{...props}
		/>
	);
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex h-full w-full items-center justify-center rounded-full bg-kumo-fill text-kumo-subtle",
			className,
		)}
		{...props}
	/>
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback, AvatarImage };
