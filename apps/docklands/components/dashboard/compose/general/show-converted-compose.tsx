import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Loader2, Puzzle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import { toast } from "@/components/shared/toast";

interface Props {
	composeId: string;
}

export const ShowConvertedCompose = ({ composeId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const {
		data: compose,
		error,
		isError,
		refetch,
	} = api.compose.getConvertedCompose.useQuery(
		{ composeId },
		{
			retry: false,
		},
	);

	const { mutateAsync, isPending } = api.compose.fetchSourceType.useMutation();

	useEffect(() => {
		if (isOpen) {
			mutateAsync({ composeId })
				.then(() => {
					refetch();
				})
				.catch(() => {});
		}
	}, [isOpen]);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button className="max-lg:w-full" variant="outline">
						<Puzzle className="h-4 w-4" />
						Preview Compose
					</Button>
				}
			/>
			<Dialog className="sm:max-w-6xl max-h-[50rem]">
				<div>
					<Dialog.Title>Converted Compose</Dialog.Title>
					<Dialog.Description>
						Preview your docker-compose file with added domains. Note: At least
						one domain must be specified for this conversion to take effect.
					</Dialog.Description>
				</div>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<AlertBlock type="info" className="mb-4">
					Preview your docker-compose file with added domains. Note: At least
					one domain must be specified for this conversion to take effect.
				</AlertBlock>
				{isPending ? (
					<div className="flex flex-row items-center justify-center min-h-[25rem] border p-4 rounded-md">
						<Loader2 className="h-8 w-8 text-kumo-subtle mb-2 animate-spin" />
					</div>
				) : compose?.length === 5 ? (
					<div className="border p-4 rounded-md flex flex-col items-center justify-center min-h-[25rem]">
						<Puzzle className="h-8 w-8 text-kumo-subtle mb-2" />
						<span className="text-kumo-subtle">
							No converted compose data available.
						</span>
					</div>
				) : (
					<>
						<div className="flex flex-row gap-2 justify-end my-4">
							<Button
								variant="secondary"
								loading={isPending}
								onClick={() => {
									mutateAsync({ composeId })
										.then(() => {
											refetch();
											toast.success("Fetched source type");
										})
										.catch((err) => {
											toast.error("Error fetching source type", {
												description: err.message,
											});
										});
								}}
							>
								Refresh <RefreshCw className="ml-2 h-4 w-4" />
							</Button>
						</div>

						<pre>
							<CodeEditor
								value={compose || ""}
								language="yaml"
								readOnly
								height="50rem"
							/>
						</pre>
					</>
				)}
			</Dialog>
		</Dialog.Root>
	);
};
