import { Button } from "@cloudflare/kumo/components/button";
import { Tooltip, TooltipProvider } from "@cloudflare/kumo/components/tooltip";
import { DatabaseZap, RefreshCw } from "lucide-react";
import { useState } from "react";
import type {
	ControllerRenderProps,
	FieldValues,
	Path,
	UseControllerProps,
} from "react-hook-form";
import { api } from "@/client/api/trpc";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Select } from "@/components/shared/select";
import type { CacheType } from "../application/domains/handle-domain";

/**
 * Loads the service names inside a compose stack via `api.compose.loadServices`,
 * owning the fetch-vs-cache toggle so callers don't re-implement it. Each backup
 * dialog that targets a compose service previously inlined this query +
 * `cacheType` state; this hook is the single source. The returned `error` is left
 * to the caller so it can place its own `AlertBlock` exactly where it wants it.
 */
export const useComposeServices = (
	composeId: string | undefined,
	{ enabled }: { enabled: boolean },
) => {
	const [cacheType, setCacheType] = useState<CacheType>("cache");

	const {
		data: services,
		isFetching: isLoadingServices,
		error,
		refetch: refetchServices,
	} = api.compose.loadServices.useQuery(
		{
			composeId: composeId ?? "",
			type: cacheType,
		},
		{
			retry: false,
			refetchOnWindowFocus: false,
			enabled,
		},
	);

	return {
		services,
		isLoadingServices,
		error,
		cacheType,
		setCacheType,
		refetchServices,
	};
};

/** The fetch/cache toggle buttons shared by every compose-service `Select`. */
const ComposeCacheToggle = ({
	cacheType,
	setCacheType,
	isLoadingServices,
	refetchServices,
}: Pick<
	ReturnType<typeof useComposeServices>,
	"cacheType" | "setCacheType" | "isLoadingServices" | "refetchServices"
>) => (
	<>
		<TooltipProvider delay={0}>
			<Tooltip
				content={
					<>
						<p>Fetch: Will clone the repository and load the services</p>
					</>
				}
				side="left"
				className="max-w-[10rem]"
				asChild
			>
				<Button
					aria-label="Fetch compose services"
					variant="secondary"
					type="button"
					loading={isLoadingServices}
					onClick={() => {
						if (cacheType === "fetch") {
							refetchServices();
						} else {
							setCacheType("fetch");
						}
					}}
				>
					<RefreshCw className="size-4 text-kumo-subtle" />
				</Button>
			</Tooltip>
		</TooltipProvider>
		<TooltipProvider delay={0}>
			<Tooltip
				content={
					<>
						<p>
							Cache: If you previously built this compose, it will read the
							services from the last build or repository fetch
						</p>
					</>
				}
				side="left"
				className="max-w-[10rem]"
				asChild
			>
				<Button
					aria-label="Load cached compose services"
					variant="secondary"
					type="button"
					loading={isLoadingServices}
					onClick={() => {
						if (cacheType === "cache") {
							refetchServices();
						} else {
							setCacheType("cache");
						}
					}}
				>
					<DatabaseZap className="size-4 text-kumo-subtle" />
				</Button>
			</Tooltip>
		</TooltipProvider>
	</>
);

type ComposeServicesState = Pick<
	ReturnType<typeof useComposeServices>,
	| "services"
	| "cacheType"
	| "setCacheType"
	| "isLoadingServices"
	| "refetchServices"
>;

interface ComposeServicePickerProps<TFieldValues extends FieldValues>
	extends ComposeServicesState {
	control: UseControllerProps<TFieldValues>["control"];
	name: Path<TFieldValues>;
	/** `aria-label` for the `Select` (differs per dialog). */
	ariaLabel: string;
	/**
	 * How the `Select` binds its value. `controlled` passes `value` (backup
	 * dialogs); `uncontrolled` passes `defaultValue` (volume dialogs).
	 */
	bindMode?: "controlled" | "uncontrolled";
	/**
	 * Whether the disabled "Empty" option is always rendered (volume dialogs)
	 * or only when there are no services (backup dialogs).
	 */
	alwaysShowEmptyOption?: boolean;
}

/**
 * Renders the "Service Name" `Select` populated from a compose stack's services,
 * with the fetch/cache toggle buttons beside it. Shared by the backup, restore,
 * and volume-backup dialogs.
 */
export const ComposeServicePicker = <TFieldValues extends FieldValues>({
	control,
	name,
	services,
	cacheType,
	setCacheType,
	isLoadingServices,
	refetchServices,
	ariaLabel,
	bindMode = "controlled",
	alwaysShowEmptyOption = false,
}: ComposeServicePickerProps<TFieldValues>) => {
	const renderEmptyOption =
		alwaysShowEmptyOption || !services || services.length === 0;

	const bindProps = (
		field: ControllerRenderProps<TFieldValues, Path<TFieldValues>>,
	) =>
		bindMode === "controlled"
			? { value: (field.value as string) || undefined }
			: { defaultValue: (field.value as string) || "" };

	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem className="w-full">
					<FormLabel>Service Name</FormLabel>
					<div className="flex gap-2">
						<FormControl>
							<Select
								aria-label={ariaLabel}
								onValueChange={field.onChange}
								{...bindProps(field)}
							>
								{services?.map((service, index) => (
									<Select.Option value={service} key={`${service}-${index}`}>
										{service}
									</Select.Option>
								))}
								{renderEmptyOption && (
									<Select.Option value="none" disabled>
										Empty
									</Select.Option>
								)}
							</Select>
						</FormControl>
						<ComposeCacheToggle
							cacheType={cacheType}
							setCacheType={setCacheType}
							isLoadingServices={isLoadingServices}
							refetchServices={refetchServices}
						/>
					</div>

					<FormMessage />
				</FormItem>
			)}
		/>
	);
};
