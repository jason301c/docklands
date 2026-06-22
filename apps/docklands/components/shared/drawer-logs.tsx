import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TerminalLine } from "../dashboard/container-runtime/logs/terminal-line";
import type { LogLine } from "../dashboard/container-runtime/logs/utils";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	filteredLogs: LogLine[];
}

export const DrawerLogs = ({ isOpen, onClose, filteredLogs }: Props) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const scrollToBottom = () => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	};

	const handleScroll = () => {
		if (!scrollRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
		setAutoScroll(isAtBottom);
	};

	useEffect(() => {
		scrollToBottom();

		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [filteredLogs, autoScroll]);
	return (
		<Dialog.Root
			open={!!isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Dialog size="xl" className="flex flex-col">
				<Dialog.Title>Build Logs</Dialog.Title>
				<Dialog.Description>
					Details of the request log entry.
				</Dialog.Description>
				<div
					ref={scrollRef}
					onScroll={handleScroll}
					className="h-[720px] overflow-y-auto space-y-0 border p-4 bg-kumo-base dark:bg-kumo-elevated rounded custom-logs-scrollbar"
				>
					{" "}
					{filteredLogs.length > 0 ? (
						filteredLogs.map((log: LogLine, index: number) => (
							<TerminalLine
								key={`${log.rawTimestamp ?? ""}-${index}`}
								log={log}
								noTimestamp
							/>
						))
					) : (
						<div className="flex justify-center items-center h-full text-kumo-subtle">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
