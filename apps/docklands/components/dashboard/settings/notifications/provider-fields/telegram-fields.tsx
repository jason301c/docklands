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

export const TelegramFields = ({ control }: ProviderFieldsProps) => (
	<>
		<FormField
			control={control}
			name="botToken"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Bot Token</FormLabel>
					<FormControl>
						<Input
							placeholder="6660491268:AAFMGmajZOVewpMNZCgJr5H7cpXpoZPgvXw"
							{...field}
						/>
					</FormControl>

					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			control={control}
			name="chatId"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Chat ID</FormLabel>
					<FormControl>
						<Input placeholder="431231869" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			control={control}
			name="messageThreadId"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Message Thread ID</FormLabel>
					<FormControl>
						<Input placeholder="11" {...field} />
					</FormControl>

					<FormMessage />
					<FormDescription>
						Optional. Use it when you want to send notifications to a specific
						topic in a group.
					</FormDescription>
				</FormItem>
			)}
		/>
	</>
);
