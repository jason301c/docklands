import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { ProviderFieldsProps } from "./types";

export const GotifyFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="serverUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Server URL</FormLabel>
					<FormControl>
						<Input placeholder="https://gotify.example.com" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="appToken"
			render={({ field }) => (
				<FormItem>
					<FormLabel>App Token</FormLabel>
					<FormControl>
						<Input placeholder="AzxcvbnmKjhgfdsa..." {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="priority"
			defaultValue={5}
			render={({ field }) => (
				<FormItem className="w-full">
					<FormLabel>Priority</FormLabel>
					<FormControl>
						<Input
							placeholder="5"
							{...field}
							onChange={(e) => {
								const value = e.target.value;
								if (value) {
									const port = Number.parseInt(value, 10);
									if (port > 0 && port < 10) {
										field.onChange(port);
									}
								}
							}}
							type="number"
						/>
					</FormControl>
					<FormDescription>Message priority (1-10, default: 5)</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="decoration"
			defaultValue={true}
			render={({ field }) => (
				<FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
					<div className="space-y-0.5">
						<FormLabel>Decoration</FormLabel>
						<FormDescription>
							Decorate the notification with emojis.
						</FormDescription>
					</div>
					<FormControl>
						<Switch checked={field.value} onCheckedChange={field.onChange} />
					</FormControl>
				</FormItem>
			)}
		/>
	</>
);
