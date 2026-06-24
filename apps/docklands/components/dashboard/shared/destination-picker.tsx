import { Button } from "@cloudflare/kumo/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import {
	type FieldValues,
	type Path,
	type UseControllerProps,
	useController,
} from "react-hook-form";
import { api } from "@/client/api/trpc";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/shared/command";
import {
	FormControl,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { ScrollArea } from "@/components/shared/scroll-area";
import { cn } from "@/shared/utils";

/**
 * A searchable combobox over the storage destinations (`api.destination.all`).
 * Shared by the backup-create and restore dialogs, which both previously inlined
 * the same `Popover` + `Command` + `destination.all` block. Owns its own query;
 * the form field drives the selected value.
 */
export const DestinationPicker = <TFieldValues extends FieldValues>({
	control,
	name,
}: {
	control: UseControllerProps<TFieldValues>["control"];
	name: Path<TFieldValues>;
}) => {
	const { data: destinations = [], isPending } = api.destination.all.useQuery();
	const { field } = useController<TFieldValues>({ control, name });
	const value = field.value as string;

	return (
		<FormItem>
			<FormLabel>Destination</FormLabel>
			<Popover>
				<PopoverTrigger asChild>
					<FormControl>
						<Button
							variant="outline"
							className={cn(
								"w-full justify-between !bg-kumo-line",
								!value && "text-kumo-subtle",
							)}
						>
							{isPending
								? "Loading...."
								: value
									? destinations.find((d) => d.destinationId === value)?.name
									: "Select Destination"}

							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</FormControl>
				</PopoverTrigger>
				<PopoverContent className="p-0" align="start">
					<Command items={[]}>
						<CommandInput placeholder="Search Destination..." className="h-9" />
						{isPending && (
							<span className="py-6 text-center text-sm">
								Loading Destinations....
							</span>
						)}
						<CommandEmpty>No destinations found.</CommandEmpty>
						<ScrollArea className="h-64">
							<CommandGroup>
								{destinations.map((destination) => (
									<CommandItem
										value={destination.destinationId}
										key={destination.destinationId}
										onSelect={() => {
											field.onChange(destination.destinationId);
										}}
									>
										{destination.name}
										<CheckIcon
											className={cn(
												"ml-auto h-4 w-4",
												destination.destinationId === value
													? "opacity-100"
													: "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</ScrollArea>
					</Command>
				</PopoverContent>
			</Popover>

			<FormMessage />
		</FormItem>
	);
};
