"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { SectionCard } from "@/components/shared/section-card";
import { Select } from "@/components/shared/select";
import { EmptyState, QueryState } from "@/components/shared/states";

const PAGE_SIZE = 50;

const ACTIONS = [
	"create",
	"update",
	"delete",
	"deploy",
	"cancel",
	"redeploy",
	"login",
	"logout",
	"restore",
	"run",
	"start",
	"stop",
	"reload",
	"rebuild",
	"move",
] as const;

const RESOURCE_TYPES = [
	"workspace",
	"service",
	"environment",
	"deployment",
	"user",
	"customRole",
	"domain",
	"certificate",
	"registry",
	"runtimeWorker",
	"sshKey",
	"gitProvider",
	"destination",
	"notification",
	"settings",
	"session",
	"port",
	"redirect",
	"security",
	"schedule",
	"backup",
	"volumeBackup",
	"docker",
	"swarm",
	"previewDeployment",
	"organization",
	"cluster",
	"mount",
	"application",
	"compose",
] as const;

const ALL = "__all__";

// Acronyms / special cases the generic humanizer can't title-case correctly.
const LABEL_OVERRIDES: Record<string, string> = {
	sshKey: "SSH key",
	api: "API key",
	url: "URL",
	ip: "IP",
};

const humanize = (value: string) =>
	LABEL_OVERRIDES[value] ??
	value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/^./, (char) => char.toUpperCase());

// Humanize a value only when it looks like a bare identifier (e.g. an enum
// like "sendInvitation"); leave emails, ids, and free text untouched.
const humanizeValue = (value: unknown): string => {
	if (typeof value === "string") {
		return /^[a-zA-Z][a-zA-Z0-9]+$/.test(value) ? humanize(value) : value;
	}
	if (value === null || typeof value === "object") return JSON.stringify(value);
	return String(value);
};

const parseMetadata = (
	metadata: string | null,
): Array<{ key: string; value: string }> | null => {
	if (!metadata) return null;
	try {
		const parsed = JSON.parse(metadata);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return Object.entries(parsed).map(([key, value]) => ({
				key: humanize(key),
				value: humanizeValue(value),
			}));
		}
	} catch {
		// Not JSON — fall back to the raw string.
	}
	return null;
};

const actionVariant = (
	action: string,
): "secondary" | "success" | "warning" | "destructive" | "info" => {
	switch (action) {
		case "create":
		case "deploy":
		case "redeploy":
		case "rebuild":
		case "start":
		case "run":
			return "success";
		case "delete":
		case "stop":
		case "cancel":
			return "destructive";
		case "update":
		case "move":
		case "reload":
		case "restore":
			return "warning";
		case "login":
		case "logout":
			return "info";
		default:
			return "secondary";
	}
};

export const ShowAuditLog = () => {
	const [resourceName, setResourceName] = useState("");
	const [action, setAction] = useState<string>(ALL);
	const [resourceType, setResourceType] = useState<string>(ALL);
	const [offset, setOffset] = useState(0);

	const auditLogQuery = api.auditLog.all.useQuery({
		resourceName: resourceName.trim() || undefined,
		action: action === ALL ? undefined : action,
		resourceType: resourceType === ALL ? undefined : resourceType,
		limit: PAGE_SIZE,
		offset,
	});

	const { data } = auditLogQuery;
	const total = data?.total ?? 0;
	const rangeStart = total === 0 ? 0 : offset + 1;
	const rangeEnd = Math.min(offset + PAGE_SIZE, total);
	const canPrev = offset > 0;
	const canNext = offset + PAGE_SIZE < total;

	const onFilterChange = (apply: () => void) => {
		setOffset(0);
		apply();
	};

	return (
		<SectionCard title="Audit Log" contentClassName="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					aria-label="Filter audit log by resource name"
					placeholder="Filter by resource name..."
					value={resourceName}
					onChange={(event) =>
						onFilterChange(() => setResourceName(event.target.value))
					}
					className="md:max-w-xs"
				/>
				<Select
					aria-label="Filter by action"
					value={action}
					onValueChange={(value) =>
						onFilterChange(() => setAction(String(value)))
					}
					className="md:max-w-[180px]"
				>
					<Select.Option value={ALL}>All actions</Select.Option>
					{ACTIONS.map((value) => (
						<Select.Option key={value} value={value}>
							{humanize(value)}
						</Select.Option>
					))}
				</Select>
				<Select
					aria-label="Filter by resource type"
					value={resourceType}
					onValueChange={(value) =>
						onFilterChange(() => setResourceType(String(value)))
					}
					className="md:max-w-[200px]"
				>
					<Select.Option value={ALL}>All resource types</Select.Option>
					{RESOURCE_TYPES.map((value) => (
						<Select.Option key={value} value={value}>
							{humanize(value)}
						</Select.Option>
					))}
				</Select>
			</div>

			<QueryState
				query={auditLogQuery}
				isEmpty={(data) => data.logs.length === 0}
				empty={
					<EmptyState
						icon={ScrollText}
						title="No audit entries match the current filters."
					/>
				}
			>
				{(data) => (
					<div className="rounded-md border overflow-auto">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>When</Table.Head>
									<Table.Head>User</Table.Head>
									<Table.Head>Action</Table.Head>
									<Table.Head>Resource</Table.Head>
									<Table.Head>Details</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{data.logs.map((log) => (
									<Table.Row key={log.id}>
										<Table.Cell className="whitespace-nowrap text-sm">
											{format(new Date(log.createdAt), "PPp")}
										</Table.Cell>
										<Table.Cell>
											<div className="flex flex-col">
												<span className="text-sm">{log.userEmail}</span>
												<span className="text-xs text-kumo-subtle">
													{log.userRole}
												</span>
											</div>
										</Table.Cell>
										<Table.Cell>
											<Badge variant={actionVariant(log.action)}>
												{humanize(log.action)}
											</Badge>
										</Table.Cell>
										<Table.Cell>
											<div className="flex flex-col">
												<span className="text-xs text-kumo-subtle">
													{humanize(log.resourceType)}
												</span>
												{log.resourceName && (
													<span className="text-sm break-words">
														{log.resourceName}
													</span>
												)}
											</div>
										</Table.Cell>
										<Table.Cell className="max-w-md align-top">
											{(() => {
												const pairs = parseMetadata(log.metadata);
												if (pairs) {
													return (
														<div className="flex flex-wrap gap-1">
															{pairs.map(({ key, value }) => (
																<span
																	key={key}
																	className="inline-flex items-center gap-1 rounded bg-kumo-tint px-1.5 py-0.5 text-xs"
																>
																	<span className="text-kumo-subtle">
																		{key}
																	</span>
																	<span className="text-kumo-default">
																		{value}
																	</span>
																</span>
															))}
														</div>
													);
												}
												if (log.metadata) {
													return (
														<span className="whitespace-pre-wrap break-words text-xs text-kumo-subtle">
															{log.metadata}
														</span>
													);
												}
												return <span className="text-kumo-subtle">—</span>;
											})()}
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</div>
				)}
			</QueryState>

			<div className="flex items-center justify-end gap-4 border-t pt-4">
				<span className="text-kumo-subtle text-sm">
					{rangeStart}–{rangeEnd} of {total}
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={!canPrev}
						onClick={() => setOffset((value) => Math.max(value - PAGE_SIZE, 0))}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={!canNext}
						onClick={() => setOffset((value) => value + PAGE_SIZE)}
					>
						Next
					</Button>
				</div>
			</div>
		</SectionCard>
	);
};
