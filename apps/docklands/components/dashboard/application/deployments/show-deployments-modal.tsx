import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { useState } from "react";
import type { RouterOutputs } from "@/client/api/trpc";
import { ShowDeployment } from "../deployments/show-deployment";
import { ShowDeployments } from "./show-deployments";

interface Props {
	id: string;
	type:
		| "application"
		| "compose"
		| "schedule"
		| "runtimeWorker"
		| "backup"
		| "previewDeployment"
		| "volumeBackup";
	runtimeWorkerId?: string;
	refreshToken?: string;
	children?: React.ReactNode;
}

export const formatDuration = (seconds: number) => {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
};

export const ShowDeploymentsModal = ({
	id,
	type,
	runtimeWorkerId,
	refreshToken,
	children,
}: Props) => {
	const [activeLog, setActiveLog] = useState<
		RouterOutputs["deployment"]["all"][number] | null
	>(null);
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					(children ? (
						children
					) : (
						<Button className="sm:w-auto w-full" size="sm" variant="outline">
							View Logs
						</Button>
					)) as never
				}
			/>
			<Dialog className="sm:max-w-5xl p-0">
				<ShowDeployments
					id={id}
					type={type}
					runtimeWorkerId={runtimeWorkerId}
					refreshToken={refreshToken}
				/>
			</Dialog>
			<ShowDeployment
				runtimeWorkerId={runtimeWorkerId || ""}
				open={Boolean(activeLog && activeLog.logPath !== null)}
				onClose={() => setActiveLog(null)}
				logPath={activeLog?.logPath || ""}
				errorMessage={activeLog?.errorMessage || ""}
			/>
		</Dialog.Root>
	);
};
