"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import copy from "copy-to-clipboard";
import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClientLogger } from "@/client/lib/logger";
import { TerminalLine } from "@/components/shared/logs/terminal-line";
import { type LogLine, parseLogs } from "@/components/shared/logs/utils";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";

const logger = createClientLogger("deployment-logs");

const EXTRA_LOGS_MARKER =
	"===================================EXTRA LOGS============================================";

interface Props {
	/** Log file to stream; null disables the stream. */
	logPath: string | null;
	/** Connect only while true (e.g. bound to a dialog's open state). */
	open?: boolean;
	/** When set, logs are tailed from this runtime worker over SSH. */
	runtimeWorkerId?: string;
	/** Fallback rendered when the stream is empty (e.g. a failed build's error). */
	errorMessage?: string;
	className?: string;
	/** Tailwind height/overflow classes for the scroll region. */
	scrollClassName?: string;
}

/**
 * Live deployment-log viewer: opens the `/listen-deployment` WebSocket, parses
 * the streamed output into typed lines, and renders them with copy, auto-scroll,
 * and (for build-server logs) an "extra logs" toggle. Shared by the per-service
 * build dialog and the centralized deployment detail drawer so both stream logs
 * the same way.
 */
export function DeploymentLogStream({
	logPath,
	open = true,
	runtimeWorkerId,
	errorMessage,
	className,
	scrollClassName,
}: Props) {
	const [data, setData] = useState("");
	const [showExtraLogs, setShowExtraLogs] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [autoScroll, setAutoScroll] = useState(true);
	const [copied, setCopied] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const handleScroll = () => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
		setAutoScroll(isAtBottom);
	};

	useEffect(() => {
		if (!open || !logPath) return;

		setData("");
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/listen-deployment?logPath=${logPath}${
			runtimeWorkerId ? `&runtimeWorkerId=${runtimeWorkerId}` : ""
		}`;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onmessage = (e) => {
			setData((currentData) => currentData + e.data);
		};
		ws.onerror = (error) => {
			logger.error("WebSocket error:", error);
			toast.warning("Log stream interrupted");
		};
		ws.onclose = () => {
			wsRef.current = null;
		};

		return () => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				ws.close();
				wsRef.current = null;
			}
		};
	}, [logPath, open, runtimeWorkerId]);

	useEffect(() => {
		const logs = parseLogs(data);
		if (!runtimeWorkerId) {
			setFilteredLogs(logs);
			return;
		}
		// Build-server logs append an "EXTRA LOGS" block; hide it unless requested.
		let hideSubsequentLogs = false;
		setFilteredLogs(
			logs.filter((log) => {
				if (log.message.includes(EXTRA_LOGS_MARKER)) {
					hideSubsequentLogs = true;
					return showExtraLogs;
				}
				return showExtraLogs ? true : !hideSubsequentLogs;
			}),
		);
	}, [data, showExtraLogs, runtimeWorkerId]);

	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [filteredLogs, autoScroll]);

	const handleCopy = async () => {
		const logContent = filteredLogs
			.map(({ timestamp, message }) =>
				`${timestamp?.toISOString() || ""} ${message}`.trim(),
			)
			.join("\n");
		const success = await copy(logContent);
		if (success) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const optionalErrors = parseLogs(errorMessage || "");

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex items-center gap-2">
				<Badge variant="neutral" className="text-xs">
					{filteredLogs.length} lines
				</Badge>
				<Button
					variant="outline"
					size="sm"
					className="h-7"
					onClick={handleCopy}
					disabled={filteredLogs.length === 0}
				>
					{copied ? (
						<Check className="h-3.5 w-3.5" />
					) : (
						<Copy className="h-3.5 w-3.5" />
					)}
				</Button>
				{runtimeWorkerId && (
					<div className="flex items-center gap-2">
						<Checkbox
							checked={showExtraLogs}
							onCheckedChange={(checked) =>
								setShowExtraLogs(checked as boolean)
							}
						/>
						<button
							type="button"
							className="text-sm font-medium"
							onClick={() => setShowExtraLogs((v) => !v)}
						>
							Show Extra Logs
						</button>
					</div>
				)}
			</div>

			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className={cn(
					"overflow-y-auto space-y-0 border p-4 bg-kumo-base rounded custom-logs-scrollbar",
					scrollClassName ?? "h-[720px]",
				)}
			>
				{filteredLogs.length > 0 ? (
					filteredLogs.map((log, index) => (
						<TerminalLine
							key={`${log.rawTimestamp ?? ""}-${index}`}
							log={log}
							noTimestamp
						/>
					))
				) : optionalErrors.length > 0 ? (
					optionalErrors.map((log, index) => (
						<TerminalLine
							key={`extra-${log.rawTimestamp ?? ""}-${index}`}
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
		</div>
	);
}
