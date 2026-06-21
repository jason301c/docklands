import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";

const Terminal = dynamic(
	() => import("./docker-terminal").then((e) => e.DockerTerminal),
	{
		ssr: false,
	},
);

interface Props {
	containerId: string;
	serverId?: string;
	children?: React.ReactNode;
}

export const DockerTerminalModal = ({
	children,
	containerId,
	serverId,
}: Props) => {
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
	return (
		<Dialog.Root open={mainDialogOpen} onOpenChange={handleMainDialogOpenChange}>
			<Dialog.Trigger render={(

				<DropdownMenu.Item
					className="w-full cursor-pointer space-x-3"
					onSelect={(e) => e.preventDefault()}
				>
					{children}
				</DropdownMenu.Item>
			
)} />
			<Dialog className="sm:max-w-7xl">
				<div>
					<Dialog.Title>Docker Terminal</Dialog.Title>
					<Dialog.Description>
						Easy way to access to docker container
					</Dialog.Description>
				</div>

				<Terminal
					id="terminal"
					containerId={containerId}
					serverId={serverId || ""}
				/>
				<Dialog.Root open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
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
