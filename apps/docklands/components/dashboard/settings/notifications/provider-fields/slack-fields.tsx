import { Input } from "@cloudflare/kumo/components/input";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { ProviderFieldsProps } from "./types";

export const SlackFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="webhookUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input
							placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
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
						<Input placeholder="Channel" {...field} />
					</FormControl>

					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);
