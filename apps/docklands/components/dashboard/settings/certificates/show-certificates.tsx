"use client";

import { Button } from "@cloudflare/kumo/components/button";
import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Link,
	Loader2,
	Server,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import { usePermissions } from "@/client/hooks/use-permissions";
import { createClientLogger } from "@/client/lib/logger";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { toast } from "@/components/shared/toast";
import { HandleCertificate } from "./handle-certificate";
import {
	extractLeafCommonName,
	getCertificateChainExpirationDetails,
	getCertificateChainInfo,
	getExpirationStatus,
} from "./utils";

const logger = createClientLogger("certificates");

export const ShowCertificates = () => {
	const { mutateAsync, isPending: isRemoving } =
		api.certificates.remove.useMutation();
	const { data, isPending, refetch } = api.certificates.all.useQuery();
	const { permissions } = usePermissions();
	const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

	return (
		<div className="w-full">
			<div className="w-full rounded-lg border bg-kumo-canvas p-6">
				<div className="">
					<h3 className="text-xl font-semibold flex items-center gap-2">
						<ShieldCheck className="size-6 text-kumo-subtle self-center" />
						Certificates
					</h3>
					<p>Create certificates in the ingress runtime directory</p>

					<AlertBlock type="warning">
						Certificates are created in the ingress runtime directory. The
						ingress runtime uses these certificates to secure your applications.
						Invalid certificates can break ingress and prevent access to your
						applications.
					</AlertBlock>
				</div>
				<div className="space-y-2 py-8 border-t">
					{isPending ? (
						<div className="flex flex-row gap-2 items-center justify-center text-sm text-kumo-subtle min-h-[25vh]">
							<span>Loading...</span>
							<Loader2 className="animate-spin size-4" />
						</div>
					) : (
						<>
							{data?.length === 0 ? (
								<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
									<ShieldCheck className="size-8 self-center text-kumo-subtle" />
									<span className="text-base text-kumo-subtle text-center">
										You don't have any certificates created
									</span>
									{permissions?.certificate.create && <HandleCertificate />}
								</div>
							) : (
								<div className="flex flex-col gap-4  min-h-[25vh]">
									<div className="flex flex-col gap-4 rounded-lg ">
										{data?.map((certificate, index) => {
											const expiration = getExpirationStatus(
												certificate.certificateData,
											);
											const chainInfo = getCertificateChainInfo(
												certificate.certificateData,
											);
											const commonName = extractLeafCommonName(
												certificate.certificateData,
											);
											const chainDetails = chainInfo.isChain
												? getCertificateChainExpirationDetails(
														certificate.certificateData,
													)
												: null;
											const isExpanded = expandedChains.has(
												certificate.certificateId,
											);

											const toggleChain = () => {
												setExpandedChains((prev) => {
													const next = new Set(prev);
													if (next.has(certificate.certificateId)) {
														next.delete(certificate.certificateId);
													} else {
														next.add(certificate.certificateId);
													}
													return next;
												});
											};

											return (
												<div
													key={certificate.certificateId}
													className="flex items-center justify-between bg-kumo-elevated p-1 w-full rounded-lg"
												>
													<div className="flex items-center justify-between p-3.5 rounded-lg bg-kumo-canvas border  w-full">
														<div className="flex items-center justify-between">
															<div className="flex gap-2 flex-col">
																<span className="text-sm font-medium">
																	{index + 1}. {certificate.name}
																</span>
																{commonName && (
																	<span className="text-xs text-kumo-subtle">
																		CN: {commonName}
																	</span>
																)}
																<span className="text-xs text-kumo-subtle flex items-center gap-1">
																	<Server className="size-3" />
																	{certificate.runtimeWorker
																		? `${certificate.runtimeWorker.name} (${certificate.runtimeWorker.ipAddress})`
																		: "Automatic placement"}
																</span>
																{chainInfo.isChain && (
																	<div className="flex flex-col gap-1.5 mt-1">
																		<button
																			type="button"
																			onClick={toggleChain}
																			className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-kumo-fill/50 w-fit hover:bg-kumo-fill transition-colors"
																		>
																			{isExpanded ? (
																				<ChevronDown className="size-3 text-kumo-subtle" />
																			) : (
																				<ChevronRight className="size-3 text-kumo-subtle" />
																			)}
																			<Link className="size-3 text-kumo-subtle" />
																			<span className="text-xs text-kumo-subtle">
																				Chain ({chainInfo.count} certificates)
																			</span>
																		</button>
																		{isExpanded && (
																			<div className="flex flex-col gap-3 pl-2 border-l-2 border-kumo-hairline">
																				{chainDetails?.map((cert) => (
																					<div
																						key={cert.index}
																						className="flex flex-col gap-1 p-2 rounded-md bg-kumo-fill/30"
																					>
																						<span className="text-xs font-medium text-kumo-subtle">
																							{cert.label}
																						</span>
																						{cert.commonName && (
																							<span className="text-xs text-kumo-subtle/80">
																								CN: {cert.commonName}
																							</span>
																						)}
																						<span
																							className={`text-xs ${cert.className}`}
																						>
																							{cert.message}
																						</span>
																					</div>
																				))}
																			</div>
																		)}
																	</div>
																)}
																<div
																	className={`text-xs flex items-center gap-1.5 ${expiration.className}`}
																>
																	{expiration.status !== "valid" && (
																		<AlertCircle className="size-3" />
																	)}
																	{expiration.message}
																	{certificate.autoRenew &&
																		expiration.status !== "valid" && (
																			<span className="text-xs text-kumo-success ml-1">
																				(Auto-renewal enabled)
																			</span>
																		)}
																</div>
															</div>
														</div>

														<div className="flex flex-row gap-1">
															{permissions?.certificate.update && (
																<HandleCertificate
																	certificateId={certificate.certificateId}
																/>
															)}

															{permissions?.certificate.delete && (
																<DialogAction
																	title="Delete Certificate"
																	description="Are you sure you want to delete this certificate?"
																	type="destructive"
																	onClick={async () => {
																		await mutateAsync({
																			certificateId: certificate.certificateId,
																		})
																			.then(() => {
																				toast.success(
																					"Certificate deleted successfully",
																				);
																				refetch();
																			})
																			.catch((err) => {
																				logger.error(err);
																				toast.error(
																					"Error deleting certificate",
																				);
																			});
																	}}
																>
																	<Button
																		aria-label="Delete certificate"
																		variant="ghost"
																		shape="square"
																		className="group hover:bg-kumo-danger/10"
																		loading={isRemoving}
																	>
																		<Trash2 className="size-4 text-kumo-brand group-hover:text-kumo-danger" />
																	</Button>
																</DialogAction>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>

									{permissions?.certificate.create && (
										<div className="flex flex-row gap-2 flex-wrap w-full justify-end mr-4">
											<HandleCertificate />
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
