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

export const MattermostFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="webhookUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input
							placeholder="https://your-mattermost.com/hooks/xxx-generatedkey-xxx"
							{...field}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			control={control}
			name="channel"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Channel</FormLabel>
					<FormControl>
						<Input placeholder="builds" {...field} />
					</FormControl>
					<FormDescription>
						Optional. Channel to post to (without #).
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			control={control}
			name="username"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Username</FormLabel>
					<FormControl>
						<Input placeholder="Docklands" {...field} />
					</FormControl>
					<FormDescription>
						Optional. Display name for the webhook.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);
