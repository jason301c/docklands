import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import dynamic from "next/dynamic";
import type React from "react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import LocalServerConfig from "./local-server-config";

const Terminal = dynamic(() => import("./terminal").then((e) => e.Terminal), {
	ssr: false,
});

const getTerminalKey = () => {
	return `terminal-${Date.now()}`;
};

interface Props {
	children?: React.ReactNode;
	serverId: string;
	asButton?: boolean;
}

export const TerminalModal = ({
	children,
	serverId,
	asButton = false,
}: Props) => {
	const [terminalKey, setTerminalKey] = useState<string>(getTerminalKey());
	const [isOpen, setIsOpen] = useState(false);
	const isLocalServer = serverId === "local";

	const { data } = api.server.one.useQuery(
		{
			serverId,
		},
		{ enabled: !!serverId && !isLocalServer },
	);

	const handleLocalServerConfigSave = () => {
		// Rerender Terminal component to reconnect using new component key when saving local server config
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
					<Dialog.Description>Easy way to access the server</Dialog.Description>
				</div>

				{isLocalServer && (
					<LocalServerConfig onSave={handleLocalServerConfigSave} />
				)}

				<div className="flex flex-col gap-4 h-[552px]">
					<Terminal id="terminal" key={terminalKey} serverId={serverId} />
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
