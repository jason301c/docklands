import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";

interface Props {
	containerId: string;
	serverId?: string;
}

export const ShowContainerConfig = ({ containerId, serverId }: Props) => {
	const { data } = api.docker.getConfig.useQuery(
		{
			containerId,
			serverId,
		},
		{
			enabled: !!containerId,
		},
	);
	return (
		<Dialog.Root>
			<Dialog.Trigger render={(

				<DropdownMenu.Item
					className="w-full cursor-pointer"
					onSelect={(e) => e.preventDefault()}
				>
					View Config
				</DropdownMenu.Item>
			
)} />
			<Dialog className={"w-full md:w-[70vw] min-w-[70vw]"}>
				<div>
					<Dialog.Title>Container Config</Dialog.Title>
					<Dialog.Description>
						See in detail the config of this container
					</Dialog.Description>
				</div>
				<div className="text-wrap rounded-lg border p-4 overflow-y-auto text-sm bg-card max-h-[80vh]">
					<code>
						<pre className="whitespace-pre-wrap break-words">
							<CodeEditor
								language="json"
								lineWrapping
								lineNumbers={false}
								readOnly
								value={JSON.stringify(data, null, 2)}
							/>
						</pre>
					</code>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
