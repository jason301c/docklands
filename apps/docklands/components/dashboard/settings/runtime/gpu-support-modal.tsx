import { useState } from "react";
import { Dialog } from "@/components/shared/dialog";
import { DropdownMenu } from "@/components/shared/dropdown";
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
				<Dialog.Header>
					<Dialog.Title className="flex items-center gap-2">
						Local Runtime GPU Setup
					</Dialog.Title>
				</Dialog.Header>

				<GPUSupport runtimeWorkerId="" />
			</Dialog>
		</Dialog.Root>
	);
};
