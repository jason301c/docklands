import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Select } from "@cloudflare/kumo/components/select";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { badgeStateColor } from "../../application/logs/show";

const Terminal = dynamic(
	() =>
		import(
			"@/components/dashboard/container-runtime/terminal/docker-terminal"
		).then((e) => e.DockerTerminal),
	{
		ssr: false,
	},
);

interface Props {
	appName: string;
	children?: React.ReactNode;
	runtimeWorkerId?: string;
	appType?: "stack" | "docker-compose";
}

export const ServiceTerminalModal = ({
	children,
	appName,
	runtimeWorkerId,
	appType,
}: Props) => {
	const { data, isPending } = api.docker.getContainersByAppNameMatch.useQuery(
		{
			appName,
			appType,
			runtimeWorkerId,
		},
		{
			enabled: !!appName,
		},
	);

	const [containerId, setContainerId] = useState<string | undefined>();
	const [mainDialogOpen, setMainDialogOpen] = useState(false);
	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

	const handleMainDialogOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmDialogOpen(true);
		} else {
			setMainDialogOpen(true);
		}
	};

	const handleConfirm = () => {
		setConfirmDialogOpen(false);
		setMainDialogOpen(false);
	};

	const handleCancel = () => {
		setConfirmDialogOpen(false);
	};

	useEffect(() => {
		if (data && data?.length > 0) {
			setContainerId(data[0]?.containerId);
		}
	}, [data]);

	return (
		<Dialog.Root
			open={mainDialogOpen}
			onOpenChange={handleMainDialogOpenChange}
		>
			<Dialog.Trigger render={children as never} />
			<Dialog className="max-h-[85vh] sm:max-w-7xl">
				<div>
					<Dialog.Title>Container Terminal</Dialog.Title>
					<Dialog.Description>
						Open an interactive shell inside one of this service's containers.
					</Dialog.Description>
				</div>
				<Select
					aria-label="Terminal container"
					onValueChange={(value) =>
						value !== null && setContainerId(value as never)
					}
					value={containerId}
				>
					<>
						{isPending ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : null}
					</>
					<>
						<Select.Group>
							{data?.map((container) => (
								<Select.Option
									key={container.containerId}
									value={container.containerId}
								>
									{container.name} ({container.containerId}){" "}
									<Badge variant={badgeStateColor(container.state)}>
										{container.state}
									</Badge>
								</Select.Option>
							))}
							<Select.GroupLabel>Containers ({data?.length})</Select.GroupLabel>
						</Select.Group>
					</>
				</Select>
				<Terminal
					runtimeWorkerId={runtimeWorkerId || ""}
					id="terminal"
					containerId={containerId || "select-a-container"}
				/>
				<Dialog.Root
					open={confirmDialogOpen}
					onOpenChange={setConfirmDialogOpen}
				>
					<Dialog>
						<div>
							<Dialog.Title>
								Are you sure you want to close the terminal?
							</Dialog.Title>
							<Dialog.Description>
								By clicking the confirm button, the terminal will be closed.
							</Dialog.Description>
						</div>
						<div>
							<Button variant="outline" onClick={handleCancel}>
								Cancel
							</Button>
							<Button onClick={handleConfirm}>Confirm</Button>
						</div>
					</Dialog>
				</Dialog.Root>
			</Dialog>
		</Dialog.Root>
	);
};
