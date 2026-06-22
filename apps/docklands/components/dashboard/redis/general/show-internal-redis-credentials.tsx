import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { api } from "@/client/api/trpc";
import { toast } from "@/components/shared/toast";
import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import { UpdateDatabasePassword } from "@/components/shared/update-database-password";

interface Props {
	redisId: string;
}
export const ShowInternalRedisCredentials = ({ redisId }: Props) => {
	const { data } = api.redis.one.useQuery({ redisId });
	const utils = api.useUtils();
	const { mutateAsync: changePassword } =
		api.redis.changePassword.useMutation();
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
								<Input aria-label="User" disabled value="default" />
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
												redisId,
												password: newPassword,
											});
											toast.success("Password updated successfully");
											utils.redis.one.invalidate({ redisId });
										}}
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Internal Port (Container)</Label>
								<Input aria-label="Internal port" disabled value="6379" />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input
									aria-label="Internal host"
									disabled
									value={data?.appName}
								/>
							</div>

							<div className="flex flex-col gap-2 md:col-span-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`redis://default:${data?.databasePassword}@${data?.appName}:6379`}
								/>
							</div>
						</div>
					</div>
				</LayerCard>
			</div>
		</>
	);
};
