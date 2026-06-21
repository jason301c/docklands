import { api } from "@/client/api/trpc";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Table } from "@cloudflare/kumo/components/table";

interface Props {
	containerId: string;
	serverId?: string;
}

interface Network {
	IPAMConfig: unknown;
	Links: unknown;
	Aliases: string[] | null;
	MacAddress: string;
	NetworkID: string;
	EndpointID: string;
	Gateway: string;
	IPAddress: string;
	IPPrefixLen: number;
	IPv6Gateway: string;
	GlobalIPv6Address: string;
	GlobalIPv6PrefixLen: number;
	DriverOpts: unknown;
}

export const ShowContainerNetworks = ({ containerId, serverId }: Props) => {
	const { data } = api.docker.getConfig.useQuery(
		{
			containerId,
			serverId,
		},
		{
			enabled: !!containerId,
		},
	);

	const networks: Record<string, Network> =
		data?.NetworkSettings?.Networks ?? {};
	const entries = Object.entries(networks);

	return (
		<Dialog.Root>
			<Dialog.Trigger render={(

				<DropdownMenu.Item
					className="w-full cursor-pointer"
					onSelect={(e) => e.preventDefault()}
				>
					View Networks
				</DropdownMenu.Item>
			
)} />
			<Dialog className="w-full md:w-[70vw] min-w-[70vw]">
				<div>
					<Dialog.Title>Container Networks</Dialog.Title>
					<Dialog.Description>
						Networks attached to this container
					</Dialog.Description>
				</div>
				<div className="overflow-auto max-h-[70vh]">
					{entries.length === 0 ? (
						<div className="text-center text-muted-foreground py-8">
							No networks found for this container.
						</div>
					) : (
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Network</Table.Head>
									<Table.Head>IP Address</Table.Head>
									<Table.Head>Gateway</Table.Head>
									<Table.Head>MAC Address</Table.Head>
									<Table.Head>Aliases</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{entries.map(([name, network]) => (
									<Table.Row key={name}>
										<Table.Cell>
											<Badge variant="outline">{name}</Badge>
										</Table.Cell>
										<Table.Cell className="font-mono text-xs">
											{network.IPAddress
												? `${network.IPAddress}/${network.IPPrefixLen}`
												: "-"}
										</Table.Cell>
										<Table.Cell className="font-mono text-xs">
											{network.Gateway || "-"}
										</Table.Cell>
										<Table.Cell className="font-mono text-xs">
											{network.MacAddress || "-"}
										</Table.Cell>
										<Table.Cell className="text-xs">
											{network.Aliases?.join(", ") || "-"}
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
