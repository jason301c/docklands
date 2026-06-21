import { cn } from "@/shared/utils";

interface TagBadgeProps {
	name: string;
	color?: string | null;
	className?: string;
	children?: React.ReactNode;
}

export function TagBadge({ name, color, className, children }: TagBadgeProps) {
	return (
		<span
			style={{
				backgroundColor: color ? `${color}33` : undefined,
				color: color || undefined,
				borderColor: color ? `${color}66` : undefined,
			}}
			className={cn(
				"inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
				className,
			)}
		>
			{name}
			{children}
		</span>
	);
}
