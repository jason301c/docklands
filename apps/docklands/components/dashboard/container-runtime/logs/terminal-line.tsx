import { Badge } from "@cloudflare/kumo/components/badge";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { FancyAnsi } from "fancy-ansi";
import escapeRegExp from "lodash/escapeRegExp";
import { cn } from "@/shared/utils";
import { getLogType, type LogLine } from "./utils";

interface LogLineProps {
	log: LogLine;
	noTimestamp?: boolean;
	searchTerm?: string;
}

const fancyAnsi = new FancyAnsi();

export function TerminalLine({ log, noTimestamp, searchTerm }: LogLineProps) {
	const { timestamp, message, rawTimestamp } = log;
	const { type, variant, color } = getLogType(message);

	const formattedTime = timestamp
		? timestamp.toLocaleString([], {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				year: "2-digit",
				second: "2-digit",
			})
		: "--- No time found ---";

	const highlightMessage = (text: string, term: string) => {
		if (!term) {
			return (
				<span
					className="transition-colors"
					dangerouslySetInnerHTML={{
						__html: fancyAnsi.toHtml(text),
					}}
				/>
			);
		}

		const htmlContent = fancyAnsi.toHtml(text);
		const searchRegex = new RegExp(`(${escapeRegExp(term)})`, "gi");

		const modifiedContent = htmlContent.replace(
			searchRegex,
			(match) => `<span class="bg-kumo-warning-tint font-bold">${match}</span>`,
		);

		return (
			<span
				className="transition-colors"
				dangerouslySetInnerHTML={{ __html: modifiedContent }}
			/>
		);
	};

	const tooltip = (color: string, timestamp: string | null) => {
		const square = (
			<div className={cn("w-2 h-full flex-shrink-0 rounded-[3px]", color)} />
		);
		return timestamp ? (
			<TooltipProvider delay={0}>
				<Tooltip
					content={
						<>
							<p className="text text-xs text-kumo-subtle break-all max-w-md">
								<pre>{timestamp}</pre>
							</p>
						</>
					}
					className="bg-kumo-elevated border-kumo-hairline z-[99999]"
					asChild
				>
					{square}
				</Tooltip>
			</TooltipProvider>
		) : (
			square
		);
	};

	return (
		<div
			className={cn(
				"font-mono text-xs flex flex-row gap-3 py-2 sm:py-0.5 group",
				type === "error"
					? "bg-kumo-danger/10 hover:bg-kumo-danger/15"
					: type === "warning"
						? "bg-kumo-warning/10 hover:bg-kumo-warning/15"
						: type === "debug"
							? "bg-kumo-warning/10 hover:bg-kumo-warning/15"
							: "hover:bg-kumo-fill",
			)}
		>
			{" "}
			<div className="flex items-start gap-x-2">
				{/* Icon to expand the log item maybe implement a collapsible later */}
				{/* <Square className="size-4 text-muted-foreground opacity-0 group-hover/logitem:opacity-100 transition-opacity" /> */}
				{tooltip(color, rawTimestamp)}
				{!noTimestamp && (
					<span className="select-none pl-2 text-kumo-subtle w-full sm:w-40 flex-shrink-0">
						{formattedTime}
					</span>
				)}

				<Badge
					variant={variant}
					className="w-14 justify-center text-[10px] px-1 py-0"
				>
					{type}
				</Badge>
			</div>
			<span className="font-mono text-kumo-default whitespace-pre-wrap break-all">
				{highlightMessage(message, searchTerm || "")}
			</span>
		</div>
	);
}
