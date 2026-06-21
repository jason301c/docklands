import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Settings } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Button, buttonVariants } from "@cloudflare/kumo/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Input } from "@cloudflare/kumo/components/input";
import { cn } from "@/shared/utils";

const Schema = z.object({
	port: z.number().min(1, "Port must be higher than 0"),
	username: z.string().min(1, "Username is required"),
});

type Schema = z.infer<typeof Schema>;

const DEFAULT_LOCAL_SERVER_DATA: Schema = {
	port: 22,
	username: "root",
};

/** Returns local server data for use with local server terminal */
export const getLocalServerData = () => {
	try {
		const localServerData = localStorage.getItem("localServerData");
		const parsedLocalServerData = localServerData
			? (JSON.parse(localServerData) as typeof DEFAULT_LOCAL_SERVER_DATA)
			: DEFAULT_LOCAL_SERVER_DATA;

		return parsedLocalServerData;
	} catch {
		return DEFAULT_LOCAL_SERVER_DATA;
	}
};

interface Props {
	onSave: () => void;
}

const LocalServerConfig = ({ onSave }: Props) => {
	const form = useForm<Schema>({
		defaultValues: getLocalServerData(),
		resolver: zodResolver(Schema),
	});

	const onSubmit = (data: Schema) => {
		localStorage.setItem("localServerData", JSON.stringify(data));
		form.reset(data);
		onSave();
	};

	return (
		<Collapsible.Root>
			<Collapsible.Trigger
				render={
					<button
						type="button"
						className={cn(
							buttonVariants({ variant: "ghost" }),
							"hover:no-underline px-1 mb-2 active:hover:transform-none",
						)}
					/>
				}
			>
				<div className="flex flex-row items-center gap-2 justify-between w-full">
					<div className="flex flex-row gap-2 items-center">
						<Settings className="h-4 w-4" />
						<span className="hover:text-kumo-strong">
							Connection settings
						</span>
					</div>
				</div>
			</Collapsible.Trigger>

			<Collapsible.Panel className="px-1 flex flex-col gap-2">
				<Form {...form}>
					<form
						id="hook-form-add-server"
						onSubmit={form.handleSubmit(onSubmit)}
						className="w-full grid grid-cols-2 gap-4"
					>
						<FormField
							control={form.control}
							name="port"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Port</FormLabel>
									<FormControl>
										<Input
											{...field}
											onChange={(e) => {
												const value = e.target.value;
												if (value === "") {
													field.onChange(1);
												} else {
													const number = Number.parseInt(value, 10);
													if (!Number.isNaN(number)) {
														field.onChange(number);
													}
												}
											}}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input placeholder="root" {...field} />
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<Button
					form="hook-form-add-server"
					type="submit"
					className={cn(
						"ml-auto",
					)}
					disabled={!form.formState.isDirty}
				>
					Save
				</Button>
			</Collapsible.Panel>
		</Collapsible.Root>
	);
};

export default LocalServerConfig;
