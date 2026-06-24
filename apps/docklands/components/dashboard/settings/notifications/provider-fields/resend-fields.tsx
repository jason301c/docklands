import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import type { UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import type {
	NotificationFormInput,
	NotificationSchema,
} from "../handle-notifications";
import type { NotificationFormControl, ToAddressesFieldArray } from "./types";

interface ResendFieldsProps {
	control: NotificationFormControl;
	form: UseFormReturn<NotificationFormInput, unknown, NotificationSchema>;
	type: string;
	fields: ToAddressesFieldArray["fields"];
	append: ToAddressesFieldArray["append"];
	remove: ToAddressesFieldArray["remove"];
}

export const ResendFields = ({
	control,
	form,
	type,
	fields,
	append,
	remove,
}: ResendFieldsProps) => (
	<>
		<FormField
			control={control}
			name="apiKey"
			render={({ field }) => (
				<FormItem>
					<FormLabel>API Key</FormLabel>
					<FormControl>
						<Input type="password" placeholder="re_********" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			control={control}
			name="fromAddress"
			render={({ field }) => (
				<FormItem>
					<FormLabel>From Address</FormLabel>
					<FormControl>
						<Input placeholder="from@example.com" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<div className="flex flex-col gap-2 pt-2">
			<FormLabel>To Addresses</FormLabel>

			{fields.map((field, index) => (
				<div key={field.id} className="flex flex-row gap-2 w-full">
					<FormField
						control={control}
						name={`toAddresses.${index}`}
						render={({ field }) => (
							<FormItem className="w-full">
								<FormControl>
									<Input
										placeholder="email@example.com"
										className="w-full"
										{...field}
									/>
								</FormControl>

								<FormMessage />
							</FormItem>
						)}
					/>
					<Button
						variant="outline"
						type="button"
						onClick={() => {
							remove(index);
						}}
					>
						Remove
					</Button>
				</div>
			))}
			{type === "resend" && "toAddresses" in form.formState.errors && (
				<div className="text-sm font-medium text-kumo-danger">
					{form.formState?.errors?.toAddresses?.root?.message}
				</div>
			)}
		</div>

		<Button
			variant="outline"
			type="button"
			onClick={() => {
				append("");
			}}
		>
			Add
		</Button>
	</>
);
