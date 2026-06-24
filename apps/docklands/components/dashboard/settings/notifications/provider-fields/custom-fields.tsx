import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { PlusIcon, Trash2 } from "lucide-react";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type { HeadersFieldArray, NotificationFormControl } from "./types";

interface CustomFieldsProps {
	control: NotificationFormControl;
	headerFields: HeadersFieldArray["fields"];
	appendHeader: HeadersFieldArray["append"];
	removeHeader: HeadersFieldArray["remove"];
}

export const CustomFields = ({
	control,
	headerFields,
	appendHeader,
	removeHeader,
}: CustomFieldsProps) => (
	<div className="space-y-4">
		<FormField
			control={control}
			name="endpoint"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Webhook URL</FormLabel>
					<FormControl>
						<Input placeholder="https://api.example.com/webhook" {...field} />
					</FormControl>
					<FormDescription>
						The URL where POST requests will be sent with notification data.
					</FormDescription>
					<FormMessage />
				</FormItem>
			)}
		/>

		<div className="space-y-3">
			<div>
				<FormLabel>Headers</FormLabel>
				<FormDescription>
					Optional. Custom headers for your POST request (e.g., Authorization,
					Content-Type).
				</FormDescription>
			</div>

			<div className="space-y-2">
				{headerFields.map((field, index) => (
					<div
						key={field.id}
						className="flex items-center gap-2 p-2 border rounded-md bg-kumo-fill/50"
					>
						<FormField
							control={control}
							name={`headers.${index}.key` as never}
							render={({ field }) => (
								<FormItem className="flex-1">
									<FormControl>
										<Input placeholder="Key" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={control}
							name={`headers.${index}.value` as never}
							render={({ field }) => (
								<FormItem className="flex-[2]">
									<FormControl>
										<Input placeholder="Value" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => removeHeader(index)}
							className="text-kumo-danger hover:text-kumo-danger hover:bg-kumo-danger-tint"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				))}
			</div>

			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => appendHeader({ key: "", value: "" })}
				className="w-full"
			>
				<PlusIcon className="h-4 w-4 mr-2" />
				Add header
			</Button>
		</div>
	</div>
);
