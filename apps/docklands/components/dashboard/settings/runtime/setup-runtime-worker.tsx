import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import copy from "copy-to-clipboard";
import { CopyIcon, ExternalLinkIcon, ServerIcon, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { toast } from "@/components/shared/toast";
import { DOCS_URL } from "@/shared/routes";

const logger = createClientLogger("runtime-worker");

import { type LogLine, parseLogs } from "@/components/shared/logs/utils";
import { ShowDeployment } from "../../application/deployments/show-deployment";
import { EditScript } from "./edit-script";
import { GPUSupport } from "./gpu-support";
import { SecurityAudit } from "./security-audit";
import { ValidateRuntimeWorker } from "./validate-runtime-worker";

interface Props {
	runtimeWorkerId: string;
	asButton?: boolean;
}

export const SetupRuntimeWorker = ({
	runtimeWorkerId,
	asButton = false,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const [setupTab, setSetupTab] = useState("ssh-keys");
	const { data: runtimeWorker } = api.runtimeWorker.one.useQuery(
		{
			runtimeWorkerId,
		},
		{
			enabled: !!runtimeWorkerId,
		},
	);

	const [activeLog, setActiveLog] = useState<string | null>(null);
	const isBuildRuntimeWorker = runtimeWorker?.runtimeWorkerType === "build";
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.runtimeWorker.setupWithLogs.useSubscription(
		{
			runtimeWorkerId: runtimeWorkerId,
		},
		{
			enabled: isDeploying,
			onData(log) {
				if (!isDrawerOpen) {
					setIsDrawerOpen(true);
				}

				if (log === "Deployment completed successfully!") {
					setIsDeploying(false);
				}
				const parsedLogs = parseLogs(log);
				setFilteredLogs((prev) => [...prev, ...parsedLogs]);
			},
			onError(error) {
				logger.error("deployment logs error:", error);
				toast.warning("Log stream interrupted — try reopening the dialog.");
				setIsDeploying(false);
			},
		},
	);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{asButton ? (
				<Dialog.Trigger
					render={
						<Button
							variant="outline"
							shape="square"
							aria-label="Set up worker"
							className="h-9 w-9"
						>
							<Settings className="h-4 w-4" />
						</Button>
					}
				/>
			) : (
				<Button
					className="w-full cursor-pointer "
					size="sm"
					onClick={() => {
						setIsOpen(true);
					}}
				>
					Set Up Worker <Settings className="size-4" />
				</Button>
			)}
			<Dialog className="sm:max-w-4xl  ">
				<div>
					<div className="flex flex-col gap-1.5">
						<Dialog.Title className="flex items-center gap-2">
							<ServerIcon className="size-5" /> Set Up Worker
						</Dialog.Title>
						<p className="text-kumo-subtle text-sm">
							To set up this worker, click the button below.
						</p>
					</div>
				</div>
				{!runtimeWorker?.sshKeyId ? (
					<div className="flex flex-col gap-2 text-sm text-kumo-subtle pt-3">
						<AlertBlock type="warning">
							Please add an SSH key to this worker before setup. You can assign
							an SSH key to this worker from Edit Worker.
						</AlertBlock>
					</div>
				) : (
					<div id="hook-form-add-gitlab" className="grid w-full gap-4">
						<AlertBlock type="info">
							You can connect as root or as a non-root user with passwordless
							sudo access. If using a non-root user, ensure passwordless sudo is
							configured.
						</AlertBlock>

						<Tabs
							value={setupTab}
							onValueChange={(value) =>
								value !== null && setSetupTab(value as never)
							}
							className="w-full overflow-auto"
							tabs={[
								{ value: "ssh-keys", label: "SSH Keys" },
								{ value: "deployments", label: "Deployments" },
								{ value: "validate", label: "Validate" },
								...(!isBuildRuntimeWorker
									? [
											{ value: "audit", label: "Security" },
											{ value: "gpu-setup", label: "GPU Setup" },
										]
									: []),
							]}
						/>
						{setupTab === "ssh-keys" && (
							<div className="outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
								<div className="flex flex-col gap-2 text-sm text-kumo-subtle pt-3">
									<p className="text-kumo-brand text-base font-semibold">
										You have two options to add SSH keys to your worker:
									</p>

									<ul>
										<li>
											1. Add the public SSH key when you create a VM in your
											preferred provider (Hostinger, Digital Ocean, Hetzner,
											etc){" "}
										</li>
										<li>2. Add the SSH key to the worker manually</li>
									</ul>
									<div className="flex flex-col gap-4 w-full overflow-auto">
										<div className="flex relative flex-col gap-2 overflow-y-auto">
											<div className="text-sm text-kumo-brand flex flex-row gap-2 items-center">
												Copy Public Key ({runtimeWorker?.sshKey?.name})
												<button
													type="button"
													aria-label={`Copy public key ${runtimeWorker?.sshKey?.name ?? ""}`.trim()}
													className="right-2 top-8"
													onClick={() => {
														copy(
															runtimeWorker?.sshKey?.publicKey ||
																"Generate a SSH Key",
														);
														toast.success("SSH Copied to clipboard");
													}}
												>
													<CopyIcon className="size-4 text-kumo-subtle" />
												</button>
											</div>
										</div>
									</div>

									<div className="flex flex-col gap-2 w-full mt-2 border rounded-lg p-4">
										<span className="text-base font-semibold text-kumo-brand">
											Automatic process
										</span>
										<Link
											href={DOCS_URL}
											target="_blank"
											className="text-kumo-brand flex flex-row gap-2"
										>
											View Tutorial <ExternalLinkIcon className="size-4" />
										</Link>
									</div>
									<div className="flex flex-col gap-2 w-full border rounded-lg p-4">
										<span className="text-base font-semibold text-kumo-brand">
											Manual process
										</span>
										<ul>
											<li className="items-center flex gap-1">
												1. Log in to your worker{" "}
												<span className="text-kumo-brand bg-kumo-fill p-1 rounded-lg">
													ssh {runtimeWorker?.username}@
													{runtimeWorker?.ipAddress}
												</span>
												<button
													type="button"
													aria-label="Copy SSH login command"
													onClick={() => {
														copy(
															`ssh ${runtimeWorker?.username}@${runtimeWorker?.ipAddress}`,
														);
														toast.success("Copied to clipboard");
													}}
												>
													<CopyIcon className="size-4" />
												</button>
											</li>
											<li>
												2. When you are logged in run the following command
												<div className="flex  relative flex-col gap-4 w-full mt-2">
													<CodeEditor
														lineWrapping
														language="properties"
														value={`echo "${runtimeWorker?.sshKey?.publicKey}" >> ~/.ssh/authorized_keys`}
														readOnly
														className="font-mono opacity-60"
													/>
													<button
														type="button"
														aria-label="Copy authorized keys command"
														className="absolute right-2 top-2"
														onClick={() => {
															copy(
																`echo "${runtimeWorker?.sshKey?.publicKey}" >> ~/.ssh/authorized_keys`,
															);
															toast.success("Copied to clipboard");
														}}
													>
														<CopyIcon className="size-4" />
													</button>
												</div>
											</li>
											<li className="mt-1">
												3. You're done, you can test the connection by entering
												to the terminal or by running the setup tab.
											</li>
										</ul>
									</div>
									<div className="flex flex-col gap-2 w-full border rounded-lg p-4">
										<span className="text-base font-semibold text-kumo-brand">
											Supported Distros:
										</span>
										<p>
											We strongly recommend to use the following distros to
											ensure the best experience:
										</p>
										<ul>
											<li>1. Ubuntu 24.04 LTS</li>
											<li>2. Ubuntu 23.10 LTS </li>
											<li>3. Ubuntu 22.04 LTS</li>
											<li>4. Ubuntu 20.04 LTS</li>
											<li>5. Ubuntu 18.04 LTS</li>
											<li>6. Debian 12</li>
											<li>7. Debian 11</li>
											<li>8. Debian 10</li>
											<li>9. Fedora 40</li>
											<li>10. Centos 9</li>
											<li>11. Centos 8</li>
										</ul>
									</div>
								</div>
							</div>
						)}
						{setupTab === "deployments" && (
							<div>
								<div className="p-0">
									<div className="flex flex-col gap-4">
										<LayerCard className="bg-kumo-canvas">
											<div className="flex flex-row items-center justify-between flex-wrap gap-2">
												<div className="flex flex-row gap-2 justify-between w-full max-sm:flex-col">
													<div className="flex flex-col gap-1">
														<h3 className="text-xl font-semibold">
															Set Up Worker
														</h3>
														<p>
															Initialize this worker with the runtime services
															Docklands needs.
														</p>
													</div>
												</div>
											</div>
											<div className="flex flex-col gap-4 min-h-[25vh] items-center">
												<div className="flex flex-col gap-4 items-center h-full max-w-xl mx-auto min-h-[25vh] justify-center">
													<span className="text-sm text-kumo-subtle text-center">
														When your worker is ready, run the setup script or
														adjust it before execution.
													</span>
													<div className="flex flex-row gap-2">
														<EditScript
															runtimeWorkerId={
																runtimeWorker?.runtimeWorkerId || ""
															}
														/>
														<DialogAction
															title={"Set Up Worker?"}
															type="default"
															description="This will initialize the worker and its associated runtime data"
															onClick={async () => {
																setIsDeploying(true);
															}}
														>
															<Button>Set Up Worker</Button>
														</DialogAction>
													</div>
												</div>

												<ShowDeployment
													open={activeLog !== null}
													onClose={() => setActiveLog(null)}
													logPath={activeLog}
												/>
											</div>
										</LayerCard>
									</div>
								</div>
							</div>
						)}
						{setupTab === "validate" && (
							<div className="outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
								<div className="flex flex-col gap-2 text-sm text-kumo-subtle pt-3">
									<ValidateRuntimeWorker runtimeWorkerId={runtimeWorkerId} />
								</div>
							</div>
						)}
						{!isBuildRuntimeWorker && (
							<>
								{setupTab === "audit" && (
									<div className="outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
										<div className="flex flex-col gap-2 text-sm text-kumo-subtle pt-3">
											<SecurityAudit runtimeWorkerId={runtimeWorkerId} />
										</div>
									</div>
								)}
								{setupTab === "gpu-setup" && (
									<div className="outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
										<div className="flex flex-col gap-2 text-sm text-kumo-subtle pt-3">
											<GPUSupport runtimeWorkerId={runtimeWorkerId} />
										</div>
									</div>
								)}
							</>
						)}
					</div>
				)}
			</Dialog>
			<DrawerLogs
				isOpen={isDrawerOpen}
				onClose={() => {
					setIsDrawerOpen(false);
					setFilteredLogs([]);
					setIsDeploying(false);
				}}
				filteredLogs={filteredLogs}
			/>
		</Dialog.Root>
	);
};
