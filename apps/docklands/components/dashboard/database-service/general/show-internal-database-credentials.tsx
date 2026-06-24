import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { SensitiveInput } from "@cloudflare/kumo/components/sensitive-input";
import { api } from "@/client/api/trpc";
import { Select } from "@/components/shared/select";
import { toast } from "@/components/shared/toast";
import {
	asLibsql,
	asMongo,
	asMysql,
	asPostgres,
	asRedis,
} from "./engine-config";
import { UpdateDatabasePassword } from "./update-database-password";

interface Props {
	databaseId: string;
}

export const ShowInternalDatabaseCredentials = ({ databaseId }: Props) => {
	const { data } = api.database.one.useQuery({ databaseId });
	const utils = api.useUtils();
	const { mutateAsync: changePassword } =
		api.database.changePassword.useMutation();

	const appName = data?.appName;
	const config = data?.config;

	const PasswordControl = ({ password }: { password?: string }) => (
		<div className="flex flex-row gap-2 items-center">
			<SensitiveInput aria-label="Password" value={password ?? ""} readOnly />
			<UpdateDatabasePassword
				onUpdatePassword={async (newPassword) => {
					await changePassword({
						databaseId,
						password: newPassword,
					});
					toast.success("Password updated successfully");
					utils.database.one.invalidate({ databaseId });
				}}
			/>
		</div>
	);

	const renderFields = () => {
		if (!data || !config) return null;

		switch (data.engine) {
			case "postgres": {
				const c = asPostgres(config);
				return (
					<>
						<div className="flex flex-col gap-2">
							<Label>User</Label>
							<Input aria-label="User" disabled value={c.databaseUser} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Database Name</Label>
							<Input
								aria-label="Database name"
								disabled
								value={c.databaseName}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Password</Label>
							<PasswordControl password={c.databasePassword} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Port (Container)</Label>
							<Input aria-label="Internal port" disabled value="5432" />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Host</Label>
							<Input aria-label="Internal host" disabled value={appName} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Connection URL </Label>
							<SensitiveInput
								aria-label="Internal connection URL"
								readOnly
								value={`postgresql://${c.databaseUser}:${c.databasePassword}@${appName}:5432/${c.databaseName}`}
							/>
						</div>
					</>
				);
			}
			case "mysql":
			case "mariadb": {
				const c = asMysql(config);
				const protocol = data.engine === "mariadb" ? "mariadb" : "mysql";
				return (
					<>
						<div className="flex flex-col gap-2">
							<Label>User</Label>
							<Input aria-label="User" disabled value={c.databaseUser} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Database Name</Label>
							<Input
								aria-label="Database name"
								disabled
								value={c.databaseName}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Password</Label>
							<PasswordControl password={c.databasePassword} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Root Password</Label>
							<div className="flex flex-row gap-2 items-center">
								<SensitiveInput
									aria-label="Root password"
									readOnly
									value={c.databaseRootPassword}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Port (Container)</Label>
							<Input aria-label="Internal port" disabled value="3306" />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Host</Label>
							<Input aria-label="Internal host" disabled value={appName} />
						</div>
						<div className="flex flex-col gap-2 md:col-span-2">
							<Label>Internal Connection URL </Label>
							<SensitiveInput
								aria-label="Internal connection URL"
								readOnly
								value={`${protocol}://${c.databaseUser}:${c.databasePassword}@${appName}:3306/${c.databaseName}`}
							/>
						</div>
					</>
				);
			}
			case "mongo": {
				const c = asMongo(config);
				return (
					<>
						<div className="flex flex-col gap-2">
							<Label>User</Label>
							<Input aria-label="User" disabled value={c.databaseUser} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Password</Label>
							<PasswordControl password={c.databasePassword} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Port (Container)</Label>
							<Input aria-label="Internal port" disabled value="27017" />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Host</Label>
							<Input aria-label="Internal host" disabled value={appName} />
						</div>
						<div className="flex flex-col gap-2 md:col-span-2">
							<Label>Internal Connection URL </Label>
							<SensitiveInput
								aria-label="Internal connection URL"
								readOnly
								value={`mongodb://${c.databaseUser}:${c.databasePassword}@${appName}:27017/?authSource=admin${c.replicaSets ? "" : "&directConnection=true"}`}
							/>
						</div>
					</>
				);
			}
			case "redis": {
				const c = asRedis(config);
				return (
					<>
						<div className="flex flex-col gap-2">
							<Label>User</Label>
							<Input aria-label="User" disabled value="default" />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Password</Label>
							<PasswordControl password={c.databasePassword} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Port (Container)</Label>
							<Input aria-label="Internal port" disabled value="6379" />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Host</Label>
							<Input aria-label="Internal host" disabled value={appName} />
						</div>
						<div className="flex flex-col gap-2 md:col-span-2">
							<Label>Internal Connection URL </Label>
							<SensitiveInput
								aria-label="Internal connection URL"
								readOnly
								value={`redis://default:${c.databasePassword}@${appName}:6379`}
							/>
						</div>
					</>
				);
			}
			case "libsql": {
				const c = asLibsql(config);
				return (
					<>
						<div className="flex flex-col gap-2">
							<Label>User</Label>
							<Input aria-label="User" disabled value={c.databaseUser} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Sqld Node</Label>
							<Select aria-label="LibSQL node" value={c.sqldNode} disabled>
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
								<SensitiveInput
									aria-label="Password"
									readOnly
									value={c.databasePassword}
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
								<Input aria-label="Internal GRPC port" disabled value="5001" />
							</div>
							<div className="w-full flex flex-col gap-2">
								<Label>Internal Admin Port (Container)</Label>
								<Input aria-label="Internal admin port" disabled value="5000" />
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Internal Host</Label>
							<Input aria-label="Internal host" disabled value={appName} />
						</div>
						<div className="flex flex-col gap-2">
							<Label>Enable Namespaces</Label>
							<Select
								aria-label="LibSQL namespaces"
								disabled
								defaultValue={
									c.enableNamespaces ? String(c.enableNamespaces) : "false"
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
							<SensitiveInput
								aria-label="Internal connection URL"
								readOnly
								value={`http://${appName}:8080`}
							/>
						</div>
						<div className="flex flex-col gap-2 md:col-span-2">
							<Label>Auth Token</Label>
							<SensitiveInput
								aria-label="Auth token"
								readOnly
								value={c.databasePassword}
							/>
						</div>
					</>
				);
			}
			default:
				return null;
		}
	};

	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-kumo-canvas">
					<div>
						<h3 className="text-xl font-semibold">Internal Credentials</h3>
					</div>
					<div className="flex w-full flex-row gap-4">
						<div className="grid w-full md:grid-cols-2 gap-4 md:gap-8">
							{renderFields()}
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
