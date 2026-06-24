import { Input } from "@cloudflare/kumo/components/input";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { ProviderFieldsProps } from "./types";

export const NtfyFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="serverUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Server URL</FormLabel>
					<FormControl>
						<Input placeholder="https://ntfy.sh" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="topic"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Topic</FormLabel>
					<FormControl>
						<Input placeholder="builds" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="accessToken"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Access Token</FormLabel>
					<FormControl>
						<Input
							placeholder="AzxcvbnmKjhgfdsa..."
							{...field}
							value={field.value ?? ""}
						/>
					</FormControl>
					<FormDescription>
						Optional. Leave blank for public topics.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			control={control}
			name="priority"
			defaultValue={3}
			render={({ field }) => (
				<FormItem className="w-full">
					<FormLabel>Priority</FormLabel>
					<FormControl>
						<Input
							placeholder="3"
							{...field}
							onChange={(e) => {
								const value = e.target.value;
								if (value) {
									const port = Number.parseInt(value, 10);
									if (port > 0 && port <= 5) {
										field.onChange(port);
									}
								}
							}}
							type="number"
						/>
					</FormControl>
					<FormDescription>Message priority (1-5, default: 3)</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);
