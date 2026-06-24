import { Button } from "@cloudflare/kumo/components/button";
import { AlertTriangle, DatabaseIcon } from "lucide-react";
import { api } from "@/client/api/trpc";
import { Dialog } from "@/components/shared/dialog";
import { SectionCard } from "@/components/shared/section-card";
import { toast } from "@/components/shared/toast";

interface Props {
	id: string;
	type: "libsql" | "mariadb" | "mongo" | "mysql" | "postgres" | "redis";
}

export const RebuildDatabase = ({ id }: Props) => {
	const utils = api.useUtils();

	const { mutateAsync, isPending } = api.database.rebuild.useMutation();

	const handleRebuild = async () => {
		try {
			await mutateAsync({
				databaseId: id,
			});
			toast.success("Database rebuilt successfully");
			await utils.invalidate();
		} catch (error) {
			toast.error("Error rebuilding database", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	return (
		<SectionCard
			icon={AlertTriangle}
			title="Danger Zone"
			className="border-kumo-danger/50"
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<h3 className="text-base font-semibold">Rebuild Database</h3>
					<p className="text-sm text-kumo-subtle">
						This action will completely reset your database to its initial
						state. All data, tables, and configurations will be removed.
					</p>
				</div>
				<Dialog.Root role="alertdialog">
					<Dialog.Trigger
						render={
							<Button
								loading={isPending}
								variant="outline"
								className="w-full border-kumo-danger/50 hover:bg-kumo-danger/10 hover:text-kumo-danger text-kumo-danger"
							>
								<DatabaseIcon className="mr-2 h-4 w-4" />
								Rebuild Database
							</Button>
						}
					/>
					<Dialog>
						<Dialog.Header>
							<Dialog.Title className="flex items-center gap-2">
								<AlertTriangle className="h-5 w-5 text-kumo-danger" />
								Are you absolutely sure?
							</Dialog.Title>
							<Dialog.Description className="space-y-2">
								<p>This action will:</p>
								<ul className="list-disc list-inside space-y-1">
									<li>Stop the current database service</li>
									<li>Delete all existing data and volumes</li>
									<li>Reset to the default configuration</li>
									<li>Restart the service with a clean state</li>
								</ul>
								<p className="font-medium text-kumo-danger mt-4">
									This action cannot be undone.
								</p>
							</Dialog.Description>
						</Dialog.Header>
						<Dialog.Footer>
							<Dialog.Close>Cancel</Dialog.Close>
							<Dialog.Close
								onClick={handleRebuild}
								className="bg-kumo-danger text-kumo-inverse hover:bg-kumo-danger/90"
								render={
									<Button loading={isPending} type="submit">
										Yes, rebuild database
									</Button>
								}
							/>
						</Dialog.Footer>
					</Dialog>
				</Dialog.Root>
			</div>
		</SectionCard>
	);
};
