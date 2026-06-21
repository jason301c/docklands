import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Activity } from "lucide-react";
import { useState } from "react";
import { ShowStorageActions } from "./show-storage-actions";
import { ShowTraefikActions } from "./show-traefik-actions";
import { ToggleDockerCleanup } from "./toggle-docker-cleanup";

interface Props {
	serverId: string;
	asButton?: boolean;
}

export const ShowServerActions = ({ serverId, asButton = false }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{asButton ? (
				<Dialog.Trigger
					render={
						<Button
							aria-label="Action"
							variant="outline"
							shape="square"
							className="h-9 w-9"
						>
							<Activity className="h-4 w-4" />
						</Button>
					}
				/>
			) : (
				<DropdownMenu.Item
					className="w-full cursor-pointer"
					onSelect={(e) => {
						e.preventDefault();
						setIsOpen(true);
					}}
				>
					View Actions
				</DropdownMenu.Item>
			)}
			<Dialog className="sm:max-w-xl">
				<div className="flex flex-col gap-1">
					<Dialog.Title className="text-xl">Ingress runtime</Dialog.Title>
					<Dialog.Description>
						Reload the edge proxy and clean runtime state.
					</Dialog.Description>
				</div>

				<div className="grid grid-cols-2 w-full gap-4">
					<ShowTraefikActions serverId={serverId} />
					<ShowStorageActions serverId={serverId} />
					<ToggleDockerCleanup serverId={serverId} />
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
