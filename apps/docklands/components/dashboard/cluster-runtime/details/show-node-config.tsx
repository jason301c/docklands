import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Settings } from "lucide-react";
import { api } from "@/client/api/trpc";
import { CodeEditor } from "@/components/shared/code-editor";

interface Props {
	nodeId: string;
	runtimeWorkerId?: string;
}

export const ShowNodeConfig = ({ nodeId, runtimeWorkerId }: Props) => {
	const { data } = api.swarm.getNodeInfo.useQuery({
		nodeId,
		runtimeWorkerId,
	});
	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<Button variant="outline" size="sm" className="w-full">
						<Settings className="h-4 w-4 mr-2" />
						Config
					</Button>
				}
			/>
			<Dialog className={"sm:max-w-5xl"}>
				<div>
					<Dialog.Title>Node Config</Dialog.Title>
					<Dialog.Description>
						See in detail the metadata of this node
					</Dialog.Description>
				</div>
				<div className="text-wrap rounded-lg border p-4 text-sm sm:max-w-[59rem] bg-kumo-base max-h-[70vh] overflow-auto ">
					<code>
						<pre className="whitespace-pre-wrap break-words items-center justify-center">
							{/* {JSON.stringify(data, null, 2)} */}
							<CodeEditor
								language="json"
								lineWrapping={false}
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
