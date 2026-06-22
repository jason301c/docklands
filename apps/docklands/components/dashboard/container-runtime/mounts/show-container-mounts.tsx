import { Badge } from "@cloudflare/kumo/components/badge";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Table } from "@cloudflare/kumo/components/table";
import { api } from "@/client/api/trpc";

interface Props {
	containerId: string;
	serverId?: string;
}

interface Mount {
	Type: string;
	Source: string;
	Destination: string;
	Mode: string;
	RW: boolean;
	Propagation: string;
	Name?: string;
	Driver?: string;
}

export const ShowContainerMounts = ({ containerId, serverId }: Props) => {
	const { data } = api.docker.getConfig.useQuery(
		{
			containerId,
			serverId,
		},
		{
			enabled: !!containerId,
		},
	);

	const mounts: Mount[] = data?.Mounts ?? [];

	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={(e) => e.preventDefault()}
					>
						View Mounts
					</DropdownMenu.Item>
				}
			/>
			<Dialog className="w-full md:w-[70vw] min-w-[70vw]">
				<div>
					<Dialog.Title>Container Mounts</Dialog.Title>
					<Dialog.Description>
						Volume and bind mounts for this container
					</Dialog.Description>
				</div>
				<div className="overflow-auto max-h-[70vh]">
					{mounts.length === 0 ? (
						<div className="text-center text-muted-foreground py-8">
							No mounts found for this container.
						</div>
					) : (
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Type</Table.Head>
									<Table.Head>Source</Table.Head>
									<Table.Head>Destination</Table.Head>
									<Table.Head>Mode</Table.Head>
									<Table.Head>Read/Write</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{mounts.map((mount, index) => (
									<Table.Row key={index}>
										<Table.Cell>
											<Badge variant="outline">{mount.Type}</Badge>
										</Table.Cell>
										<Table.Cell className="font-mono text-xs max-w-[250px] truncate">
											{mount.Name || mount.Source}
										</Table.Cell>
										<Table.Cell className="font-mono text-xs max-w-[250px] truncate">
											{mount.Destination}
										</Table.Cell>
										<Table.Cell className="text-xs">
											{mount.Mode || "-"}
										</Table.Cell>
										<Table.Cell>
											<Badge variant={mount.RW ? "secondary" : "secondary"}>
												{mount.RW ? "RW" : "RO"}
											</Badge>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
