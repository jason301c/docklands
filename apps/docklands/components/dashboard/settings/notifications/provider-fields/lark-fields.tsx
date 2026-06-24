import { Input } from "@cloudflare/kumo/components/input";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { ProviderFieldsProps } from "./types";

export const LarkFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="webhookUrl"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input
							placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxxxxxxxxx"
							{...field}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	</>
);
