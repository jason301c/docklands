import { Input } from "@cloudflare/kumo/components/input";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { NotificationFormControl } from "./types";

interface PushoverFieldsProps {
	control: NotificationFormControl;
	/** The watched `priority` value; emergency (2) reveals retry/expire. */
	priority: unknown;
}

export const PushoverFields = ({ control, priority }: PushoverFieldsProps) => (
	<>
		<FormField
			control={control}
			name="userKey"
			render={({ field }) => (
				<FormItem>
					<FormLabel>User Key</FormLabel>
					<FormControl>
						<Input placeholder="ub3de9kl2q..." {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="apiToken"
			render={({ field }) => (
				<FormItem>
					<FormLabel>API Token</FormLabel>
					<FormControl>
						<Input placeholder="a3d9k2q7m4..." {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="priority"
			defaultValue={0}
			render={({ field }) => (
				<FormItem className="w-full">
					<FormLabel>Priority</FormLabel>
					<FormControl>
						<Input
							placeholder="0"
							value={field.value ?? 0}
							onChange={(e) => {
								const value = e.target.value;
								if (value === "" || value === "-") {
									field.onChange(0);
								} else {
									const priority = Number.parseInt(value, 10);
									if (
										!Number.isNaN(priority) &&
										priority >= -2 &&
										priority <= 2
									) {
										field.onChange(priority);
									}
								}
							}}
							type="number"
							min={-2}
							max={2}
						/>
					</FormControl>
					<FormDescription>
						Message priority (-2 to 2, default: 0, emergency: 2)
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
		{priority === 2 && (
			<>
				<FormField
					control={control}
					name="retry"
					render={({ field }) => (
						<FormItem className="w-full">
							<FormLabel>Retry (seconds)</FormLabel>
							<FormControl>
								<Input
									placeholder="30"
									{...field}
									value={field.value ?? ""}
									onChange={(e) => {
										const value = e.target.value;
										if (value === "") {
											field.onChange(undefined);
										} else {
											const retry = Number.parseInt(value, 10);
											if (!Number.isNaN(retry)) {
												field.onChange(retry);
											}
										}
									}}
									type="number"
									min={30}
								/>
							</FormControl>
							<FormDescription>
								How often (in seconds) to retry. Minimum 30 seconds.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={control}
					name="expire"
					render={({ field }) => (
						<FormItem className="w-full">
							<FormLabel>Expire (seconds)</FormLabel>
							<FormControl>
								<Input
									placeholder="3600"
									{...field}
									value={field.value ?? ""}
									onChange={(e) => {
										const value = e.target.value;
										if (value === "") {
											field.onChange(undefined);
										} else {
											const expire = Number.parseInt(value, 10);
											if (!Number.isNaN(expire)) {
												field.onChange(expire);
											}
										}
									}}
									type="number"
									min={1}
									max={10800}
								/>
							</FormControl>
							<FormDescription>
								How long to keep retrying (max 10800 seconds / 3 hours).
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
			</>
		)}
	</>
);
