import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import { UpdateDatabasePassword } from "@/components/shared/update-database-password";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";

interface Props {
	mariadbId: string;
}
export const ShowInternalMariadbCredentials = ({ mariadbId }: Props) => {
	const { data } = api.mariadb.one.useQuery({ mariadbId });
	const utils = api.useUtils();
	const { mutateAsync: changePassword } =
		api.mariadb.changePassword.useMutation();
	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<LayerCard className="bg-background">
					<div>
						<h3 className="text-xl">Internal Credentials</h3>
					</div>
					<div className="flex w-full flex-row gap-4">
						<div className="grid w-full md:grid-cols-2 gap-4 md:gap-8">
							<div className="flex flex-col gap-2">
								<Label>User</Label>
								<Input disabled value={data?.databaseUser} />
							</div>
							<div className="flex flex-col gap-2">
								<Label>Database Name</Label>
								<Input disabled value={data?.databaseName} />
							</div>
							<div className="flex flex-col gap-2">
								<Label>Password</Label>
								<div className="flex flex-row gap-2 items-center">
									<ToggleVisibilityInput
										disabled
										value={data?.databasePassword}
									/>
									<UpdateDatabasePassword
										onUpdatePassword={async (newPassword) => {
											await changePassword({
												mariadbId,
												password: newPassword,
												type: "user",
											});
											toast.success("Password updated successfully");
											utils.mariadb.one.invalidate({ mariadbId });
										}}
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Root Password</Label>
								<div className="flex flex-row gap-2 items-center">
									<ToggleVisibilityInput
										disabled
										value={data?.databaseRootPassword}
									/>
									<UpdateDatabasePassword
										label="Root Password"
										onUpdatePassword={async (newPassword) => {
											await changePassword({
												mariadbId,
												password: newPassword,
												type: "root",
											});
											toast.success("Root password updated successfully");
											utils.mariadb.one.invalidate({ mariadbId });
										}}
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Internal Port (Container)</Label>
								<Input disabled value="3306" />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input disabled value={data?.appName} />
							</div>

							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`mariadb://${data?.databaseUser}:${data?.databasePassword}@${data?.appName}:3306/${data?.databaseName}`}
								/>
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
