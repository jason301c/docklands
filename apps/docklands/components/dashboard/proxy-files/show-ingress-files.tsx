import {
	Folder,
	FolderOpen,
	Loader2,
	MousePointerClick,
	Workflow,
} from "lucide-react";
import React from "react";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { Tree } from "./file-tree";
import { ShowIngressFile } from "./show-ingress-file";

interface Props {
	runtimeWorkerId?: string;
}
export const ShowIngressFiles = ({ runtimeWorkerId }: Props) => {
	const [file, setFile] = React.useState<null | string>(null);

	const {
		data: directories,
		isLoading,
		error,
		isError,
	} = api.settings.readDirectories.useQuery(
		{
			runtimeWorkerId,
		},
		{
			retry: 2,
		},
	);

	return (
		<div className="space-y-4">
			<AlertBlock type="warning">
				Invalid ingress configuration can break access to your applications.
			</AlertBlock>
			<div>
				<div className="flex w-full flex-col gap-4 md:gap-10 lg:flex-row">
					{isError && (
						<AlertBlock type="error" className="w-full">
							{error?.message}
						</AlertBlock>
					)}
					{isLoading && (
						<div className="w-full flex-col gap-2 flex items-center justify-center h-[55vh]">
							<span className="text-kumo-subtle text-lg font-medium">
								Loading...
							</span>
							<Loader2 className="animate-spin size-8 text-kumo-subtle" />
						</div>
					)}
					{directories?.length === 0 && (
						<div className="w-full flex-col gap-4 flex items-center justify-center h-[55vh] border border-dashed rounded-lg">
							<div className="flex items-center justify-center size-14 rounded-full bg-kumo-fill">
								<FolderOpen className="size-7 text-kumo-subtle" />
							</div>
							<div className="flex flex-col items-center gap-1 text-center px-4">
								<span className="text-base font-medium">
									No ingress files found
								</span>
								<span className="text-sm text-kumo-subtle">
									There are no ingress files in{" "}
									<code className="bg-kumo-fill px-1.5 py-0.5 rounded text-xs">
										/etc/docklands/traefik
									</code>{" "}
									on this runtime yet.
								</span>
							</div>
						</div>
					)}
					{directories && directories?.length > 0 && (
						<>
							<Tree
								data={directories}
								className="lg:max-w-[19rem] w-full lg:h-[660px] border rounded-lg"
								onSelectChange={(item) => setFile(item?.id || null)}
								folderIcon={Folder}
								itemIcon={Workflow}
							/>
							<div className="w-full">
								{file ? (
									<ShowIngressFile
										path={file}
										runtimeWorkerId={runtimeWorkerId}
									/>
								) : (
									<div className="h-full min-h-[300px] w-full flex-col gap-4 flex items-center justify-center border border-dashed rounded-lg">
										<div className="flex items-center justify-center size-14 rounded-full bg-kumo-fill">
											<MousePointerClick className="size-7 text-kumo-subtle" />
										</div>
										<div className="flex flex-col items-center gap-1 text-center px-4">
											<span className="text-base font-medium">
												Select a file to edit
											</span>
											<span className="text-sm text-kumo-subtle">
												Choose a file from the tree on the left to view and edit
												its contents.
											</span>
										</div>
									</div>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
