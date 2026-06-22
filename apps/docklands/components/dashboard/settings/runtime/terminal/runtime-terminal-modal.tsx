import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import dynamic from "next/dynamic";
import type React from "react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { LocalRuntimeTerminalConfig } from "./local-runtime-terminal-config";

const RuntimeTerminal = dynamic(
	() => import("./runtime-terminal").then((e) => e.RuntimeTerminal),
	{
		ssr: false,
	},
);

const getTerminalKey = () => {
	return `terminal-${Date.now()}`;
};

interface Props {
	children?: React.ReactNode;
	serverId: string;
	asButton?: boolean;
}

export const RuntimeTerminalModal = ({
	children,
	serverId,
	asButton = false,
}: Props) => {
	const [terminalKey, setTerminalKey] = useState<string>(getTerminalKey());
	const [isOpen, setIsOpen] = useState(false);
	const isLocalRuntime = serverId === "local";

	const { data } = api.runtimeWorker.one.useQuery(
		{
			serverId,
		},
		{ enabled: !!serverId && !isLocalRuntime },
	);

	const handleLocalRuntimeConfigSave = () => {
		// Rerender the terminal to reconnect using the updated local runtime settings.
		setTerminalKey(getTerminalKey());
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{asButton ? (
				<Dialog.Trigger render={children as never} />
			) : (
				<DropdownMenu.Item
					className="w-full cursor-pointer space-x-3"
					onSelect={(e) => {
						e.preventDefault();
						setIsOpen(true);
					}}
				>
					{children}
				</DropdownMenu.Item>
			)}
			<Dialog className="sm:max-w-7xl">
				<div className="flex flex-col gap-1">
					<Dialog.Title>Terminal ({data?.name ?? serverId})</Dialog.Title>
					<Dialog.Description>
						Open an SSH session to this runtime worker.
					</Dialog.Description>
				</div>

				{isLocalRuntime && (
					<LocalRuntimeTerminalConfig onSave={handleLocalRuntimeConfigSave} />
				)}

				<div className="flex flex-col gap-4 h-[552px]">
					<RuntimeTerminal
						id="terminal"
						key={terminalKey}
						serverId={serverId}
					/>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
