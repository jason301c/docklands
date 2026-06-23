import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with Tailwind conflict resolution (mirrors the app's `cn`). */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
