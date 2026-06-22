import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/shared/utils";

interface Props extends React.ComponentPropsWithoutRef<"div"> {
	icon?: React.ReactNode;
	type?: "info" | "success" | "warning" | "error";
}

const iconMap = {
	info: {
		className: "bg-kumo-info-tint text-kumo-info",
		icon: Info,
	},
	success: {
		className: "bg-kumo-success-tint text-kumo-success",
		icon: CheckCircle2,
	},
	warning: {
		className: "bg-kumo-warning-tint text-kumo-warning",
		icon: AlertCircle,
	},
	error: {
		className: "bg-kumo-danger-tint text-kumo-danger",
		icon: AlertTriangle,
	},
};

export function AlertBlock({
	type = "info",
	icon,
	children,
	className,
	...props
}: Props) {
	const { className: iconClassName, icon: Icon } = iconMap[type];
	return (
		<div
			{...props}
			className={cn(
				"flex items-start flex-row gap-4 rounded-lg p-2",
				iconClassName,
				className,
			)}
		>
			<div className="flex-shrink-0 mt-0.5">
				{icon || <Icon className="text-current" />}
			</div>
			<div className="flex-1 min-w-0">
				<span className="text-sm text-current break-words overflow-wrap-anywhere whitespace-pre-wrap">
					{children}
				</span>
			</div>
		</div>
	);
}
