import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import { UpdateDatabasePassword } from "@/components/shared/update-database-password";

interface Props {
	mongoId: string;
}
export const ShowInternalMongoCredentials = ({ mongoId }: Props) => {
	const { data } = api.mongo.one.useQuery({ mongoId });
	const utils = api.useUtils();
	const { mutateAsync: changePassword } =
		api.mongo.changePassword.useMutation();
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
								<Label>Password</Label>
								<div className="flex flex-row gap-2 items-center">
									<ToggleVisibilityInput
										disabled
										value={data?.databasePassword}
									/>
									<UpdateDatabasePassword
										onUpdatePassword={async (newPassword) => {
											await changePassword({
												mongoId,
												password: newPassword,
											});
											toast.success("Password updated successfully");
											utils.mongo.one.invalidate({ mongoId });
										}}
									/>
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Port (Container)</Label>
								<Input disabled value="27017" />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input disabled value={data?.appName} />
							</div>

							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`mongodb://${data?.databaseUser}:${data?.databasePassword}@${data?.appName}:27017/?authSource=admin${data?.replicaSets ? "" : "&directConnection=true"}`}
								/>
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
