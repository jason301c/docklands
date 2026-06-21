import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { FileTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "@/components/shared/toast";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { CodeEditor } from "@/components/shared/code-editor";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";

interface Props {
	serverId: string;
}

const schema = z.object({
	command: z.string().min(1, {
		message: "Command is required",
	}),
});

type Schema = z.infer<typeof schema>;

export const EditScript = ({ serverId }: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: server } = api.server.one.useQuery(
		{
			serverId,
		},
		{
			enabled: !!serverId,
		},
	);

	const { mutateAsync, isPending } = api.server.update.useMutation();

	const { data: defaultCommand } = api.server.getDefaultCommand.useQuery(
		{
			serverId,
		},
		{
			enabled: !!serverId,
		},
	);

	const form = useForm<Schema>({
		defaultValues: {
			command: "",
		},
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (server) {
			form.reset({
				command: server.command || defaultCommand,
			});
		}
	}, [server, defaultCommand]);

	const onSubmit = async (formData: Schema) => {
		if (server) {
			await mutateAsync({
				...server,
				command: formData.command || "",
				serverId,
			})
				.then((_data) => {
					toast.success("Script modified successfully");
				})
				.catch(() => {
					toast.error("Error modifying the script");
				});
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger render={(

				<Button variant="outline">
					Modify Script
					<FileTerminal className="size-4 text-muted-foreground" />
				</Button>
			
)} />
			<Dialog className="sm:max-w-5xl overflow-x-hidden">
				<div>
					<Dialog.Title>Modify Script</Dialog.Title>
					<Dialog.Description>
						Modify the script which install everything necessary to deploy
						applications on your server,
					</Dialog.Description>

					<AlertBlock type="warning">
						We recommend not modifying this script unless you know what you are
						doing.
					</AlertBlock>
				</div>
				<div className="grid gap-4">
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							id="hook-form-delete-application"
							className="grid w-full gap-4"
						>
							<FormField
								control={form.control}
								name="command"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Command</FormLabel>
										<FormControl className="max-h-[75vh] max-w-[60rem] overflow-y-scroll overflow-x-hidden">
											<CodeEditor
												language="shell"
												wrapperClassName="font-mono"
												{...field}
												placeholder={`
set -e
echo "Hello world"
`}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</form>
					</Form>
				</div>
				<div className="flex justify-between w-full">
					<Button
						variant="secondary"
						onClick={() => {
							form.reset({
								command: defaultCommand || "",
							});
						}}
					>
						Reset
					</Button>
					<Button
						loading={isPending}
						form="hook-form-delete-application"
						type="submit"
					>
						Save
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
