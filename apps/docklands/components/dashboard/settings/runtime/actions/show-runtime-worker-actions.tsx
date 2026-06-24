import { Button } from "@cloudflare/kumo/components/button";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Activity } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/shared/dialog";
import { ShowIngressActions } from "./show-ingress-actions";
import { ShowStorageActions } from "./show-storage-actions";
import { ToggleDockerCleanup } from "./toggle-docker-cleanup";

interface Props {
	runtimeWorkerId: string;
	asButton?: boolean;
}

export const ShowRuntimeWorkerActions = ({
	runtimeWorkerId,
	asButton = false,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{asButton ? (
				<Dialog.Trigger
					render={
						<Button
							aria-label="Open worker runtime actions"
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
				<Dialog.Header>
					<Dialog.Title className="text-xl">Ingress runtime</Dialog.Title>
					<Dialog.Description>
						Reload the edge proxy and clean runtime state.
					</Dialog.Description>
				</Dialog.Header>

				<div className="grid grid-cols-2 w-full gap-4">
					<ShowIngressActions runtimeWorkerId={runtimeWorkerId} />
					<ShowStorageActions runtimeWorkerId={runtimeWorkerId} />
					<ToggleDockerCleanup runtimeWorkerId={runtimeWorkerId} />
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
