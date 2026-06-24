import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { FilePlus } from "lucide-react";
import { useState } from "react";
import { CodeEditor } from "@/components/shared/code-editor";
import { Dialog } from "@/components/shared/dialog";

interface Props {
	folderPath: string;
	onCreate: (filename: string, content: string) => void;
	onOpenChange: (open: boolean) => void;
	alwaysVisible?: boolean;
}

export const CreateFileDialog = ({
	folderPath,
	onCreate,
	onOpenChange,
	alwaysVisible = false,
}: Props) => {
	const [filename, setFilename] = useState("");
	const [content, setContent] = useState("");

	const handleCreate = () => {
		if (!filename.trim()) return;
		onCreate(filename.trim(), content);
		setFilename("");
		setContent("");
		onOpenChange(false);
	};

	return (
		<Dialog.Root>
			<Dialog.Trigger
				render={
					<Button
						aria-label="Create file"
						variant="ghost"
						shape="square"
						type="button"
						className={`h-6 w-6 ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100"}`}
						title="Create file"
					>
						<FilePlus className="h-3 w-3" />
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleCreate();
					}}
				>
					<Dialog.Header>
						<Dialog.Title>Create file</Dialog.Title>
						<Dialog.Description>
							{folderPath ? `New file in ${folderPath}/` : "New file in root"}
						</Dialog.Description>
					</Dialog.Header>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="filename">Filename</Label>
							<Input
								aria-label="Filename"
								id="filename"
								placeholder="e.g. .env.example"
								value={filename}
								onChange={(e) => setFilename(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Content</Label>
							<div className="h-[200px] rounded-md border">
								<CodeEditor
									value={content}
									onChange={(v) => setContent(v ?? "")}
									className="h-full"
									wrapperClassName="h-[200px]"
									lineWrapping
								/>
							</div>
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close
							render={
								<Button variant="outline" type="button">
									Cancel
								</Button>
							}
						/>
						<Dialog.Close
							render={
								<Button type="submit" disabled={!filename.trim()}>
									Create
								</Button>
							}
						/>
					</Dialog.Footer>
				</form>
			</Dialog>
		</Dialog.Root>
	);
};
