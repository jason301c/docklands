import { toast } from "@/components/shared/toast";
import { api } from "@/client/api/trpc";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import { UpdateDatabasePassword } from "@/components/shared/update-database-password";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";

interface Props {
	postgresId: string;
}
export const ShowInternalPostgresCredentials = ({ postgresId }: Props) => {
	const { data } = api.postgres.one.useQuery({ postgresId });
	const utils = api.useUtils();
	const { mutateAsync: changePassword } =
		api.postgres.changePassword.useMutation();
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
										value={data?.databasePassword}
										disabled
									/>
									<UpdateDatabasePassword
										onUpdatePassword={async (newPassword) => {
											await changePassword({
												postgresId,
												password: newPassword,
											});
											toast.success("Password updated successfully");
											utils.postgres.one.invalidate({ postgresId });
										}}
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Internal Port (Container)</Label>
								<Input disabled value="5432" />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input disabled value={data?.appName} />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`postgresql://${data?.databaseUser}:${data?.databasePassword}@${data?.appName}:5432/${data?.databaseName}`}
								/>
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
// ReplyError: MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk. Commands that may modify the data set are disabled, because this instance is configured to report errors during writes if RDB snapshotting fails (stop-w
