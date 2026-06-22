import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { api } from "@/client/api/trpc";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";

interface Props {
	libsqlId: string;
}
export const ShowInternalLibsqlCredentials = ({ libsqlId }: Props) => {
	const { data } = api.libsql.one.useQuery({ libsqlId });
	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">Internal Credentials</h3>
					</div>
					<div className="flex w-full flex-row gap-4">
						<div className="grid w-full md:grid-cols-2 gap-4 md:gap-8">
							<div className="flex flex-col gap-2">
								<Label>User</Label>
								<Input aria-label="User" disabled value={data?.databaseUser} />
							</div>
							<div className="flex flex-col gap-2">
								<Label>Sqld Node</Label>
								<Select
									aria-label="LibSQL node"
									value={data?.sqldNode}
									disabled
								>
									<></>
									<>
										{["primary", "replica"].map((node) => (
											<Select.Option key={node} value={node}>
												{node.charAt(0).toUpperCase() + node.slice(1)}
											</Select.Option>
										))}
									</>
								</Select>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Password</Label>
								<div className="flex flex-row gap-4">
									<ToggleVisibilityInput
										disabled
										value={data?.databasePassword}
									/>
								</div>
							</div>

							<div className="flex flex-row gap-2">
								<div className="w-full flex flex-col gap-2">
									<Label>Internal Port (Container)</Label>
									<Input aria-label="Internal port" disabled value="8080" />
								</div>
								<div className="w-full flex flex-col gap-2">
									<Label>Internal GRPC Port (Container)</Label>
									<Input
										aria-label="Internal GRPC port"
										disabled
										value="5001"
									/>
								</div>
								<div className="w-full flex flex-col gap-2">
									<Label>Internal Admin Port (Container)</Label>
									<Input
										aria-label="Internal admin port"
										disabled
										value="5000"
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input
									aria-label="Internal host"
									disabled
									value={data?.appName}
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Enable Namespaces</Label>
								<Select
									aria-label="LibSQL namespaces"
									disabled
									defaultValue={
										data?.enableNamespaces
											? String(data?.enableNamespaces)
											: "false"
									}
								>
									<></>
									<>
										<Select.Group>
											{["false", "true"].map((node) => (
												<Select.Option key={node} value={node}>
													{node.charAt(0).toUpperCase() + node.slice(1)}
												</Select.Option>
											))}
										</Select.Group>
									</>
								</Select>
							</div>

							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`http://${data?.databaseUser}:${data?.databasePassword}@${data?.appName}:8080`}
								/>
							</div>
							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Internal Replication Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`http://${data?.databaseUser}:${data?.databasePassword}@${data?.appName}:5001`}
								/>
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
