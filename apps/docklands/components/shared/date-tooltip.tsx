import { format, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { cn } from "@/shared/utils";

interface Props {
	date: string;
	children?: React.ReactNode;
	className?: string;
}

export const DateTooltip = ({ date, children, className }: Props) => {
	return (
		<TooltipProvider delay={0}>
			<Tooltip content={<>{format(new Date(date), "PPpp")}</>}>
					<span
						className={cn(
							"flex items-center text-muted-foreground text-left",
							className,
						)}
					>
						{children}{" "}
						{formatDistanceToNow(new Date(date), {
							addSuffix: true,
						})}
					</span>
				</Tooltip>
		</TooltipProvider>
	);
};
