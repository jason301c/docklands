import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import {
	ArrowUpDown,
	CheckCircle2,
	ExternalLink,
	Loader2,
	PenBoxIcon,
	RefreshCw,
	Server,
	Trash2,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import type { RouterOutputs } from "@/client/api/trpc";
import { DialogAction } from "@/components/shared/dialog-action";
import { DnsHelperModal } from "./dns-helper-modal";
import { AddDomain } from "./handle-domain";
import type { ValidationStates } from "./show-domains";

export type Domain =
	| RouterOutputs["domain"]["byApplicationId"][0]
	| RouterOutputs["domain"]["byComposeId"][0];

interface ColumnsProps {
	id: string;
	type: "application" | "compose";
	validationStates: ValidationStates;
	handleValidateDomain: (host: string) => Promise<void>;
	handleDeleteDomain: (domainId: string) => Promise<void>;
	isDeleting: boolean;
	ingressAddress?: string;
	canCreateDomain: boolean;
	canDeleteDomain: boolean;
}

export const createColumns = ({
	id,
	type,
	validationStates,
	handleValidateDomain,
	handleDeleteDomain,
	isDeleting,
	ingressAddress,
	canCreateDomain,
	canDeleteDomain,
}: ColumnsProps): ColumnDef<Domain>[] => [
	...(type === "compose"
		? [
				{
					accessorKey: "serviceName",
					header: "Service",
					cell: ({ row }: { row: { getValue: (key: string) => unknown } }) => {
						const serviceName = row.getValue("serviceName") as string | null;
						if (!serviceName) return null;
						return (
							<Badge variant="outline">
								<Server className="size-3 mr-1" />
								{serviceName}
							</Badge>
						);
					},
				} satisfies ColumnDef<Domain>,
			]
		: []),
	{
		accessorKey: "host",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Host
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const domain = row.original;
			return (
				<Link
					className="flex items-center gap-2 font-medium hover:underline"
					target="_blank"
					href={`${domain.https ? "https" : "http"}://${domain.host}${domain.path}`}
				>
					{domain.host}
					<ExternalLink className="size-3" />
				</Link>
			);
		},
	},
	{
		accessorKey: "path",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Path
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const path = row.getValue("path") as string;
			return <div className="font-mono text-sm">{path || "/"}</div>;
		},
	},
	{
		accessorKey: "port",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Port
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const port = row.getValue("port") as number;
			return <Badge variant="secondary">{port}</Badge>;
		},
	},
	{
		accessorKey: "customEntrypoint",
		header: "Entrypoint",
		cell: ({ row }) => {
			const entrypoint = row.getValue("customEntrypoint") as string | null;
			if (!entrypoint) return <span className="text-kumo-subtle">-</span>;
			return <div className="font-mono text-sm">{entrypoint}</div>;
		},
	},
	{
		accessorKey: "https",
		header: "Protocol",
		cell: ({ row }) => {
			const https = row.getValue("https") as boolean;
			return (
				<Badge variant={https ? "outline" : "secondary"}>
					{https ? "HTTPS" : "HTTP"}
				</Badge>
			);
		},
	},
	{
		id: "certificate",
		header: "Certificate",
		cell: ({ row }) => {
			const domain = row.original;
			const validationState = validationStates[domain.host];

			return (
				<div className="flex items-center gap-2">
					{domain.certificateType && (
						<Badge variant="outline" className="capitalize">
							{domain.certificateType}
						</Badge>
					)}
					{!domain.host.includes("sslip.io") && (
						<TooltipProvider>
							<Tooltip
								content={
									<>
										{validationState?.error ? (
											<div className="flex flex-col gap-1">
												<p className="font-medium text-kumo-danger">Error:</p>
												<p>{validationState.error}</p>
											</div>
										) : (
											"Click to validate DNS configuration"
										)}
									</>
								}
								className="max-w-xs"
								asChild
							>
								<Button
									type="button"
									variant="outline"
									size="xs"
									className={
										validationState?.isValid
											? "bg-kumo-success/10 text-kumo-success cursor-pointer"
											: validationState?.error
												? "bg-kumo-danger/10 text-kumo-danger cursor-pointer"
												: "bg-kumo-warning/10 text-kumo-warning cursor-pointer"
									}
									onClick={() => handleValidateDomain(domain.host)}
								>
									{validationState?.isLoading ? (
										<>
											<Loader2 className="size-3 mr-1 animate-spin" />
											Checking...
										</>
									) : validationState?.isValid ? (
										<>
											<CheckCircle2 className="size-3 mr-1" />
											{validationState.message && validationState.cdnProvider
												? `${validationState.cdnProvider}`
												: "Valid"}
										</>
									) : validationState?.error ? (
										<>
											<XCircle className="size-3 mr-1" />
											Invalid
										</>
									) : (
										<>
											<RefreshCw className="size-3 mr-1" />
											Validate
										</>
									)}
								</Button>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => {
			return (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Created
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			);
		},
		cell: ({ row }) => {
			const createdAt = row.getValue("createdAt") as string;
			return (
				<div className="text-sm text-kumo-subtle">
					{new Date(createdAt).toLocaleDateString()}
				</div>
			);
		},
	},
	{
		id: "actions",
		header: "Actions",
		enableHiding: false,
		cell: ({ row }) => {
			const domain = row.original;

			return (
				<div className="flex items-center gap-2">
					{!domain.host.includes("sslip.io") && (
						<DnsHelperModal
							domain={{
								host: domain.host,
								https: domain.https,
								path: domain.path || undefined,
							}}
							ingressAddress={ingressAddress}
						/>
					)}
					{canCreateDomain && (
						<AddDomain id={id} type={type} domainId={domain.domainId}>
							<Button
								aria-label="Edit domain"
								variant="ghost"
								shape="square"
								className="group hover:bg-kumo-brand/10 h-8 w-8"
							>
								<PenBoxIcon className="size-3.5 text-kumo-brand group-hover:text-kumo-brand" />
							</Button>
						</AddDomain>
					)}
					{canDeleteDomain && (
						<DialogAction
							title="Delete Domain"
							description="Are you sure you want to delete this domain?"
							type="destructive"
							onClick={async () => {
								await handleDeleteDomain(domain.domainId);
							}}
						>
							<Button
								aria-label="Delete domain"
								variant="ghost"
								shape="square"
								className="group hover:bg-kumo-danger/10 h-8 w-8"
								loading={isDeleting}
							>
								<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
							</Button>
						</DialogAction>
					)}
				</div>
			);
		},
	},
];
