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
							"size-3.5 rounded-full bg-kumo-subtle dark:bg-kumo-base",
							className,
						)}
					/>
				)}
				{status === "error" && (
					<div
						className={cn("size-3.5 rounded-full bg-kumo-danger", className)}
					/>
				)}
				{status === "done" && (
					<div
						className={cn("size-3.5 rounded-full bg-kumo-success", className)}
					/>
				)}
				{status === "cancelled" && (
					<div
						className={cn("size-3.5 rounded-full bg-kumo-subtle", className)}
					/>
				)}
				{status === "running" && (
					<div
						className={cn("size-3.5 rounded-full bg-kumo-warning", className)}
					/>
				)}
			</Tooltip>
		</TooltipProvider>
	);
};
