import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { CodeEditor } from "@/components/shared/code-editor";

interface Props {
	data: unknown;
}

export const ShowNodeData = ({ data }: Props) => {
	return (
		<Dialog.Root>
			<Dialog.Trigger
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
				<div>
					<Dialog.Title>Node Config</Dialog.Title>
					<Dialog.Description>
						See in detail the metadata of this node
					</Dialog.Description>
				</div>
				<div className="text-wrap rounded-lg border p-4 text-sm sm:max-w-[59rem] bg-card">
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
