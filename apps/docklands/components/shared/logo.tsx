import { cn } from "@/shared/utils";

interface Props {
	className?: string;
	logoUrl?: string;
}

export const Logo = ({ className = "size-14", logoUrl }: Props) => {
	return (
		<img
			src={logoUrl ?? "/icon.svg"}
			alt={logoUrl ? "Organization Logo" : "Docklands"}
			className={cn(className, "object-contain", logoUrl && "rounded-sm")}
		/>
	);
};
