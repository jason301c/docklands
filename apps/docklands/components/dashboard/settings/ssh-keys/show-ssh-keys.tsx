"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, Trash2 } from "lucide-react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { DialogAction } from "@/components/shared/dialog-action";
import { EmptyState, QueryState } from "@/components/shared/states";
import { toast } from "@/components/shared/toast";

const logger = createClientLogger("ssh-keys");

import { HandleSSHKeys } from "./handle-ssh-keys";

export const ShowSshKeys = () => {
	const sshKeysQuery = api.sshKey.all.useQuery();
	const { refetch } = sshKeysQuery;
	const { mutateAsync, isPending: isRemoving } =
		api.sshKey.remove.useMutation();
	const { permissions } = usePermissions();

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<KeyRound className="size-6 text-kumo-subtle self-center" />
						SSH Keys
					</h3>
					<p>
						Create and manage SSH Keys, you can use them to access your runtime
						workers, git private repositories, and more.
					</p>
				</div>
				<div className="space-y-2 py-8 border-t">
					<QueryState
						query={sshKeysQuery}
						isEmpty={(data) => data.length === 0}
						empty={
							<EmptyState
								icon={KeyRound}
								title="You don't have any SSH keys"
								action={permissions?.sshKeys.create ? <HandleSSHKeys /> : null}
							/>
						}
					>
						{(data) => (
							<div className="flex flex-col gap-4  min-h-[25vh]">
								<div className="flex flex-col gap-4 rounded-lg ">
									{data.map((sshKey, index) => (
										<div
											key={sshKey.sshKeyId}
											className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
										>
											<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
												<div className="flex items-center justify-between">
													<div className="flex flex-col">
														<span className="text-sm font-medium">
															{index + 1}. {sshKey.name}
														</span>
														{sshKey.description && (
															<div>
																<span className="text-xs text-kumo-subtle">
																	{sshKey.description}
																</span>
																<div className="text-xs  text-kumo-subtle">
																	Created:{" "}
																	{formatDistanceToNow(
																		new Date(sshKey.createdAt),
																		{
																			addSuffix: true,
																		},
																	)}
																</div>
															</div>
														)}
													</div>
												</div>

												<div className="flex flex-row gap-1">
													<HandleSSHKeys sshKeyId={sshKey.sshKeyId} />

													{permissions?.sshKeys.delete && (
														<DialogAction
															title="Delete SSH Key"
															description="Are you sure you want to delete this SSH Key?"
															type="destructive"
															onClick={async () => {
																await mutateAsync({
																	sshKeyId: sshKey.sshKeyId,
																})
																	.then(() => {
																		toast.success(
																			"SSH Key deleted successfully",
																		);
																		refetch();
																	})
																	.catch((err) => {
																		logger.error(err);
																		toast.error("Error deleting SSH Key");
																	});
															}}
														>
															<Button
																aria-label="Delete SSH key"
																variant="ghost"
																shape="square"
																className="group hover:bg-kumo-danger/10 "
																loading={isRemoving}
															>
																<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
															</Button>
														</DialogAction>
													)}
												</div>
											</div>
										</div>
									))}
								</div>

								{permissions?.sshKeys.create && (
									<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
										<HandleSSHKeys />
									</div>
								)}
							</div>
						)}
					</QueryState>
				</div>
			</div>
		</div>
	);
};
