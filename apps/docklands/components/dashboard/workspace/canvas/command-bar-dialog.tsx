"use client";

import { Dialog } from "@cloudflare/kumo/components/dialog";
import { ArrowRight, Search } from "lucide-react";
import type { ReactNode } from "react";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";

export type CommandGroup =
	| "Create"
	| "Environments"
	| "Services"
	| "Actions"
	| "System";

export type CommandItem = {
	id: string;
	group: CommandGroup;
	label: string;
	detail: string;
	search: string;
	icon: ReactNode;
	run: () => void;
};

export const CommandBarDialog = ({
	open,
	onOpenChange,
	commandQuery,
	setCommandQuery,
	filteredCommandItems,
	commandGroups,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commandQuery: string;
	setCommandQuery: (value: string) => void;
	filteredCommandItems: CommandItem[];
	commandGroups: CommandGroup[];
}) => {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title>Command Bar</Dialog.Title>
				</div>
				<div className="relative">
					<FocusShortcutInput
						autoFocus
						placeholder="Search commands..."
						value={commandQuery}
						onChange={(event) => setCommandQuery(event.target.value)}
						className="pr-9"
					/>
					<Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-kumo-subtle" />
				</div>
				<div className="max-h-[22rem] space-y-2 overflow-auto">
					{filteredCommandItems.length === 0 ? (
						<div className="rounded-lg border border-dashed p-5 text-center text-sm text-kumo-subtle">
							No commands found.
						</div>
					) : (
						commandGroups.map((group) => {
							const items = filteredCommandItems.filter(
								(item) => item.group === group,
							);
							if (items.length === 0) return null;

							return (
								<div key={group} className="space-y-1">
									<div className="px-1 text-xs font-medium uppercase text-kumo-subtle">
										{group}
									</div>
									{items.map((item) => (
										<button
											key={item.id}
											type="button"
											className="flex w-full items-center justify-between gap-3 rounded-md border bg-kumo-canvas px-3 py-2 text-left hover:bg-kumo-fill/40"
											onClick={item.run}
										>
											<span className="flex min-w-0 items-center gap-3">
												<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-kumo-fill/30">
													{item.icon}
												</span>
												<span className="min-w-0">
													<span className="block truncate text-sm font-medium">
														{item.label}
													</span>
													<span className="block truncate text-xs text-kumo-subtle">
														{item.detail}
													</span>
												</span>
											</span>
											<ArrowRight className="size-4 shrink-0 text-kumo-subtle" />
										</button>
									))}
								</div>
							);
						})
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
