import { Dialog } from "@/components/shared/dialog";
import { DeploymentLogStream } from "@/components/shared/logs/deployment-log-stream";

interface Props {
	logPath: string | null;
	open: boolean;
	onClose: () => void;
	runtimeWorkerId?: string;
	errorMessage?: string;
}

export const ShowDeployment = ({
	logPath,
	open,
	onClose,
	runtimeWorkerId,
	errorMessage,
}: Props) => {
	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<Dialog className="sm:max-w-5xl">
				<Dialog.Header>
					<Dialog.Title>Build</Dialog.Title>
					<Dialog.Description>
						See all the details of this build.
					</Dialog.Description>
				</Dialog.Header>
				<DeploymentLogStream
					logPath={logPath}
					open={open}
					runtimeWorkerId={runtimeWorkerId}
					errorMessage={errorMessage}
				/>
			</Dialog>
		</Dialog.Root>
	);
};
