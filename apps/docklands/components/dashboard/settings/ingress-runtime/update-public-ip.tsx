import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { AlertBlock } from "@/components/shared/alert-block";
import { Dialog } from "@/components/shared/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { toast } from "@/components/shared/toast";

const schema = z.object({
	serverIp: z.string(),
});

type Schema = z.infer<typeof schema>;

interface Props {
	children?: React.ReactNode;
	runtimeWorkerId?: string;
}

export const UpdatePublicIp = ({ children }: Props) => {
	const [isOpen, setIsOpen] = useState(false);

	const { data, refetch } = api.settings.getWebServerSettings.useQuery();
	const { data: ip } = api.runtimeWorker.publicIp.useQuery();

	const { mutateAsync, isPending, error, isError } =
		api.settings.updateServerIp.useMutation();

	const form = useForm<Schema>({
		defaultValues: {
			serverIp: data?.serverIp || "",
		},
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				serverIp: data.serverIp || "",
			});
		}
	}, [form, form.reset, data]);

	const setCurrentIp = () => {
		if (!ip) return;
		form.setValue("serverIp", ip);
	};

	const onSubmit = async (data: Schema) => {
		await mutateAsync({
			serverIp: data.serverIp,
		})
			.then(async () => {
				toast.success("Public IP updated");
				await refetch();
				setIsOpen(false);
			})
			.catch(() => {
				toast.error("Error updating public IP");
			});
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger render={children as never} />
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>Update Public IP</Dialog.Title>
					<Dialog.Description>
						Set the public IP used by this Docklands runtime.
					</Dialog.Description>
				</Dialog.Header>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-update-public-ip"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="serverIp"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Public IP</FormLabel>
									<div className="flex gap-2">
										<FormControl>
											<Input {...field} />
										</FormControl>
										<TooltipProvider delay={0}>
											<Tooltip
												content={
													<>
														<p>Set current public IP</p>
													</>
												}
												side="left"
												className="max-w-[11rem]"
												asChild
											>
												<Button
													aria-label="Set current public IP"
													variant="secondary"
													type="button"
													onClick={setCurrentIp}
												>
													<RefreshCw className="size-4 text-kumo-subtle" />
												</Button>
											</Tooltip>
										</TooltipProvider>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<Dialog.Footer>
						<Button
							loading={isPending}
							disabled={isPending}
							form="hook-form-update-public-ip"
							type="submit"
						>
							Update
						</Button>
					</Dialog.Footer>
				</Form>
			</Dialog>
		</Dialog.Root>
	);
};
