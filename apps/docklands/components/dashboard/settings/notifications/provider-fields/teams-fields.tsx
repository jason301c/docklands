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

export const TeamsFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="webhookUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input
							placeholder="https://xxx.webhook.office.com/webhookb2/..."
							{...field}
						/>
					</FormControl>
					<FormDescription>
						Incoming Webhook URL from a Teams channel. Add an Incoming Webhook
						in your channel settings to get the URL.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);
