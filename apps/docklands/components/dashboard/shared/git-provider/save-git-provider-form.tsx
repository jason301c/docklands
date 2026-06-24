import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { Select } from "@/components/shared/select";

/**
 * Shared chrome for the per-provider git-source save forms (application +
 * compose). This component owns the parts that are byte-for-byte identical
 * across every provider/service-type pairing — the account `Select`, the
 * build/compose path input, the submodules toggle, and the submit button — and
 * accepts the genuinely divergent regions (the optional repository-load error
 * alert, repository combobox, branch combobox, trigger-type, and watch-paths)
 * as ready-made nodes from each caller, so each provider keeps its exact query
 * wiring, markup, and behavior.
 */

export interface GitProviderAccount {
	/** The provider-id used both as the option value and React key. */
	id: string;
	/** The human-readable account name shown in the option. */
	name: string;
}

interface SaveGitProviderFormProps {
	/** The react-hook-form instance owned by the caller. */
	form: UseFormReturn<any>;
	onSubmit: () => void;
	/** Repository-load error rendered above the grid, if any. */
	alert?: ReactNode;
	/** Label for the account `Select` field, e.g. "GitHub Account". */
	accountLabel: string;
	/** `aria-label` for the account `Select`. */
	accountAriaLabel: string;
	/** Form field name for the provider id, e.g. "githubId". */
	accountFieldName: string;
	/** The available provider accounts. */
	accounts: GitProviderAccount[] | undefined;
	/** Called when the account changes, so the caller can reset repo/branch. */
	onAccountChange: (value: string) => void;
	/** The repository combobox + label row, fully owned by the caller. */
	repositorySelector: ReactNode;
	/** The branch combobox, fully owned by the caller. */
	branchSelector: ReactNode;
	/** Label for the path input ("Build Path" or "Compose Path"). */
	pathLabel: string;
	/** Placeholder for the path input ("/" or "docker-compose.yml"). */
	pathPlaceholder: string;
	/** Form field name for the path, e.g. "buildPath" or "composePath". */
	pathFieldName: string;
	/** Optional trigger-type field (GitHub only). */
	triggerTypeField?: ReactNode;
	/** The watch-paths editor, fully owned by the caller. */
	watchPathsField: ReactNode;
	/** Whether the save button is in its loading state. */
	isSaving: boolean;
	/**
	 * The compose Gitea form renders a slightly different submit row — a
	 * `flex justify-end` wrapper and a button without the `w-fit` class — so the
	 * submit area is configurable to preserve that exact markup.
	 */
	submitWrapperClassName?: string;
	submitButtonClassName?: string;
}

export const SaveGitProviderForm = ({
	form,
	onSubmit,
	alert,
	accountLabel,
	accountAriaLabel,
	accountFieldName,
	accounts,
	onAccountChange,
	repositorySelector,
	branchSelector,
	pathLabel,
	pathPlaceholder,
	pathFieldName,
	triggerTypeField,
	watchPathsField,
	isSaving,
	submitWrapperClassName = "flex w-full justify-end",
	submitButtonClassName = "w-fit",
}: SaveGitProviderFormProps) => {
	return (
		<div>
			<Form {...form}>
				<form onSubmit={onSubmit} className="grid w-full gap-4 py-3">
					{alert}
					<div className="grid md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name={accountFieldName}
							render={({ field }) => (
								<FormItem className="md:col-span-2 flex flex-col">
									<FormLabel>{accountLabel}</FormLabel>
									<FormControl>
										<Select
											aria-label={accountAriaLabel}
											onValueChange={(value) => {
												if (value === null) return;
												field.onChange(value);
												onAccountChange(value);
											}}
											defaultValue={field.value}
											value={field.value}
										>
											{accounts?.map((account) => (
												<Select.Option key={account.id} value={account.id}>
													{account.name}
												</Select.Option>
											))}
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{repositorySelector}
						{branchSelector}

						<FormField
							control={form.control}
							name={pathFieldName}
							render={({ field }) => (
								<FormItem>
									<FormLabel>{pathLabel}</FormLabel>
									<FormControl>
										<Input placeholder={pathPlaceholder} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{triggerTypeField}
						{watchPathsField}

						<FormField
							control={form.control}
							name="enableSubmodules"
							render={({ field }) => (
								<FormItem className="flex items-center space-x-2">
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<FormLabel className="!mt-0">Enable Submodules</FormLabel>
								</FormItem>
							)}
						/>
					</div>
					<div className={submitWrapperClassName}>
						<Button
							loading={isSaving}
							type="submit"
							className={submitButtonClassName}
						>
							Save
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
};
