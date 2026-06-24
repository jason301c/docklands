import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { CodeEditor } from "@/components/shared/code-editor";
import { Dialog } from "@/components/shared/dialog";

interface Props {
	data: unknown;
}

export const ShowClusterNodeData = ({ data }: Props) => {
	return (
		<Dialog.Root>
			<Dialog.Trigger
				nativeButton={false}
				render={
					<DropdownMenu.Item
						className="w-full cursor-pointer"
						onSelect={(e) => e.preventDefault()}
					>
						View Config
					</DropdownMenu.Item>
				}
			/>
			<Dialog className={"sm:max-w-5xl"}>
				<Dialog.Header>
					<Dialog.Title>Node Config</Dialog.Title>
					<Dialog.Description>
						See in detail the metadata of this node
					</Dialog.Description>
				</Dialog.Header>
				<div className="text-wrap rounded-lg border p-4 text-sm sm:max-w-[59rem] bg-kumo-base">
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
