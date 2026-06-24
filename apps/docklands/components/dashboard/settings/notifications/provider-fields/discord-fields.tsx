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

export const DiscordFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="webhookUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input
							placeholder="https://discord.com/api/webhooks/123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ"
							{...field}
						/>
					</FormControl>

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
