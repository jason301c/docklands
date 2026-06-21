import { ExternalLink, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { AddManager } from "./manager/add-manager";
import { AddWorker } from "./workers/add-worker";

interface Props {
	serverId?: string;
}

export const AddNode = ({ serverId }: Props) => {
	const [activeTab, setActiveTab] = useState("worker");

	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<Button className="w-full cursor-pointer space-x-3">
						<PlusIcon className="h-4 w-4" />
						Add Node
					</Button>
				}
			/>
			<Dialog className="sm:max-w-4xl">
				<div>
					<Dialog.Title>Add Node</Dialog.Title>
					<Dialog.Description className="flex flex-col gap-2">
						Follow the steps to add a new node to your cluster, before you start
						using this feature, you need to understand how docker swarm works.{" "}
						<Link
							href="https://docs.docker.com/engine/swarm/"
							target="_blank"
							className="text-primary flex flex-row gap-2 items-center"
						>
							Docker Swarm
							<ExternalLink className="h-4 w-4" />
						</Link>
						<Link
							href="https://docs.docker.com/engine/swarm/how-swarm-mode-works/nodes/"
							target="_blank"
							className="text-primary flex flex-row gap-2 items-center"
						>
							Architecture
							<ExternalLink className="h-4 w-4" />
						</Link>
						<AlertBlock type="warning">
							Make sure you use the same architecture as the node you are
							adding.
						</AlertBlock>
					</Dialog.Description>
				</div>
				<div className="flex flex-col gap-2">
					<Tabs
						value={activeTab}
						onValueChange={(value) => value !== null && setActiveTab(value as never)}
						tabs={[
							{ value: "worker", label: "Worker" },
							{ value: "manager", label: "Manager" },
						]}
					/>
					{activeTab === "worker" && (
						<div className="pt-4 overflow-hidden">
							<AddWorker serverId={serverId} />
						</div>
					)}
					{activeTab === "manager" && (
						<div className="pt-4 overflow-hidden">
							<AddManager serverId={serverId} />
						</div>
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
