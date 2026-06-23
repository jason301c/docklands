import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { useState } from "react";
import { GPUSupport } from "./gpu-support";

export const GPUSupportModal = () => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				nativeButton={false}
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={(e) => e.preventDefault()}
					>
						<span>GPU Setup</span>
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="sm:max-w-4xl">
				<div>
					<Dialog.Title className="flex items-center gap-2">
						Local Runtime GPU Setup
					</Dialog.Title>
				</div>

				<GPUSupport runtimeWorkerId="" />
			</Dialog>
		</Dialog.Root>
	);
};
