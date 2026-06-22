import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { cn } from "@/shared/utils";

interface Props {
	status:
		| "running"
		| "error"
		| "done"
		| "idle"
		| "cancelled"
		| undefined
		| null;
	className?: string;
}

export const StatusTooltip = ({ status, className }: Props) => {
	return (
		<TooltipProvider delay={0}>
			<Tooltip
				content={
					<>
						<span>
							{status === "idle" && "Idle"}
							{status === "error" && "Error"}
							{status === "done" && "Done"}
							{status === "running" && "Running"}
							{status === "cancelled" && "Cancelled"}
						</span>
					</>
				}
				align="center"
			>
				{status === "idle" && (
					<div
						className={cn(
							"size-3.5 rounded-full bg-muted-foreground dark:bg-card",
							className,
						)}
					/>
				)}
				{status === "error" && (
					<div
						className={cn("size-3.5 rounded-full bg-destructive", className)}
					/>
				)}
				{status === "done" && (
					<div
						className={cn("size-3.5 rounded-full bg-green-500", className)}
					/>
				)}
				{status === "cancelled" && (
					<div
						className={cn(
							"size-3.5 rounded-full bg-muted-foreground",
							className,
						)}
					/>
				)}
				{status === "running" && (
					<div
						className={cn("size-3.5 rounded-full bg-yellow-500", className)}
					/>
				)}
			</Tooltip>
		</TooltipProvider>
	);
};
